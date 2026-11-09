import hashlib
import time
from collections import defaultdict, deque

import httpx
from fastapi import Request

from .config import Settings


class RateLimitError(Exception):
    def __init__(self, retry_after: int, code: str = "rate_limited"):
        self.retry_after, self.code = max(1, int(retry_after)), code


class AuthError(Exception):
    pass


class RateLimiter:
    """Sliding-window limiter kept in memory. It is per service instance: run a shared store (e.g. Redis)
    if you run several copies behind a load balancer."""

    def __init__(self, clock=time.monotonic):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._clock = clock

    def check(self, key: str, limit: int, window_s: float) -> None:
        now = self._clock()
        q = self._hits[key]
        while q and now - q[0] >= window_s:
            q.popleft()
        if len(q) >= limit:
            raise RateLimitError(window_s - (now - q[0]))
        q.append(now)
        if len(self._hits) > 20_000:  # keep memory bounded
            for k in [k for k, v in self._hits.items() if not v][:5_000]:
                self._hits.pop(k, None)


class DailyBudget:
    """Hard cap on AI provider calls per UTC day, to bound cost."""

    def __init__(self, limit: int, today=lambda: time.strftime("%Y-%m-%d", time.gmtime())):
        self._limit, self._today, self._day, self._count = limit, today, None, 0

    def spend(self) -> None:
        day = self._today()
        if day != self._day:
            self._day, self._count = day, 0
        if self._count >= self._limit:
            raise RateLimitError(3600, code="daily_limit")
        self._count += 1


def client_ip(request: Request, trust_proxy: bool) -> str:
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]


class SupabaseAuth:
    """Confirms a request comes from a signed-in EstateHub user by asking Supabase Auth about the token.
    Uses only the publishable key. The token is cached briefly so repeated calls stay fast."""

    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None, ttl_s: float = 60.0, clock=time.monotonic):
        self._s, self._ttl, self._clock = settings, ttl_s, clock
        self._cache: dict[str, tuple[str, float]] = {}
        self._client = httpx.AsyncClient(timeout=8.0, transport=transport)

    async def verify(self, authorization: str | None) -> str:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise AuthError("Missing token")
        token = authorization[7:].strip()
        if not token or len(token) > 4096:
            raise AuthError("Invalid token")
        digest = hashlib.sha256(token.encode()).hexdigest()
        hit = self._cache.get(digest)
        now = self._clock()
        if hit and hit[1] > now:
            return hit[0]
        try:
            resp = await self._client.get(
                f"{self._s.supabase_url}/auth/v1/user",
                headers={"apikey": self._s.supabase_publishable_key, "Authorization": f"Bearer {token}"},
            )
        except httpx.HTTPError as e:
            raise AuthError("Could not verify the session") from e
        if resp.status_code != 200:
            raise AuthError("Invalid or expired session")
        try:
            uid = resp.json().get("id")
        except ValueError as e:
            raise AuthError("Invalid response from auth") from e
        if not uid:
            raise AuthError("Invalid response from auth")
        if len(self._cache) > 5_000:
            self._cache.clear()
        self._cache[digest] = (uid, now + self._ttl)
        return uid

    async def aclose(self):
        await self._client.aclose()
