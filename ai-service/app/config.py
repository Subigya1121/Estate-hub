import os
from dataclasses import dataclass, field

PROVIDERS = ("mock", "anthropic", "openai")


class ConfigError(RuntimeError):
    pass


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _int(value: str | None, default: int) -> int:
    try:
        return int(value) if value not in (None, "") else default
    except ValueError as e:
        raise ConfigError(f"Expected a whole number but got {value!r}") from e


@dataclass(frozen=True)
class Settings:
    provider: str = "mock"
    api_key: str | None = field(default=None, repr=False)  # never printed
    model: str | None = None
    base_url: str | None = None
    supabase_url: str | None = None
    supabase_publishable_key: str | None = field(default=None, repr=False)
    require_auth: bool = True
    allowed_origins: tuple[str, ...] = ("http://localhost:5173",)
    trust_proxy: bool = False
    rate_describe_per_hour: int = 20
    rate_search_per_minute: int = 15
    rate_concierge_per_minute: int = 10
    daily_limit: int = 2000
    request_timeout_s: float = 25.0
    max_body_bytes: int = 20_000

    @classmethod
    def from_env(cls, env: dict | None = None) -> "Settings":
        e = os.environ if env is None else env
        origins = tuple(o.strip() for o in (e.get("ALLOWED_ORIGINS") or "http://localhost:5173").split(",") if o.strip())
        s = cls(
            provider=(e.get("AI_PROVIDER") or "mock").strip().lower(),
            api_key=(e.get("AI_API_KEY") or None),
            model=(e.get("AI_MODEL") or None),
            base_url=(e.get("AI_BASE_URL") or None),
            supabase_url=((e.get("SUPABASE_URL") or "").rstrip("/") or None),
            supabase_publishable_key=(e.get("SUPABASE_PUBLISHABLE_KEY") or None),
            require_auth=_bool(e.get("AI_REQUIRE_AUTH"), True),
            allowed_origins=origins,
            trust_proxy=_bool(e.get("TRUST_PROXY"), False),
            rate_describe_per_hour=_int(e.get("RATE_DESCRIBE_PER_HOUR"), 20),
            rate_search_per_minute=_int(e.get("RATE_SEARCH_PER_MINUTE"), 15),
            rate_concierge_per_minute=_int(e.get("RATE_CONCIERGE_PER_MINUTE"), 10),
            daily_limit=_int(e.get("AI_DAILY_LIMIT"), 2000),
        )
        s.validate()
        return s

    def validate(self) -> None:
        if self.provider not in PROVIDERS:
            raise ConfigError(f"AI_PROVIDER must be one of {', '.join(PROVIDERS)}")
        if self.provider != "mock" and not (self.api_key and self.model):
            raise ConfigError("AI_API_KEY and AI_MODEL are required when AI_PROVIDER is not 'mock'")
        if self.require_auth and not (self.supabase_url and self.supabase_publishable_key):
            raise ConfigError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required when AI_REQUIRE_AUTH is true")
        for key in (self.api_key, self.supabase_publishable_key):
            if key and key.startswith("sb_secret_"):
                raise ConfigError("A Supabase secret key was provided. Use the publishable key; this service never needs a secret key.")
        if min(self.rate_describe_per_hour, self.rate_search_per_minute, self.rate_concierge_per_minute, self.daily_limit) < 1:
            raise ConfigError("Rate limits must be at least 1")
