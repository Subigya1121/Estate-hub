import logging

from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings
from .providers import Provider, ProviderError, get_provider
from .schemas import ConciergeRequest, ConciergeResponse, DescribeRequest, DescribeResponse, SearchRequest, SearchResponse
from .security import AuthError, DailyBudget, RateLimiter, RateLimitError, SupabaseAuth, client_ip
from .services import describe_property, parse_search, run_concierge

log = logging.getLogger("estatehub.ai")


def _error(status: int, code: str, message: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status, headers=headers)


def create_app(settings: Settings | None = None, provider: Provider | None = None, auth_transport=None, provider_transport=None) -> FastAPI:
    settings = settings or Settings.from_env()
    provider = provider or get_provider(settings, provider_transport)
    auth = SupabaseAuth(settings, transport=auth_transport) if settings.require_auth else None
    limiter, budget = RateLimiter(), DailyBudget(settings.daily_limit)

    app = FastAPI(title="EstateHub AI service", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings, app.state.provider, app.state.limiter = settings, provider, limiter

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > settings.max_body_bytes:
            return _error(413, "too_large", "That request is too large.")
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def invalid(_: Request, exc: RequestValidationError):
        # report which fields are wrong, but never echo what the user typed
        fields = sorted({".".join(str(p) for p in e["loc"] if p != "body") for e in exc.errors()})
        return JSONResponse({"error": {"code": "invalid_request", "message": "Some details are missing or invalid.", "fields": fields}}, status_code=422)

    @app.exception_handler(RateLimitError)
    async def limited(_: Request, exc: RateLimitError):
        message = "The AI assistant has reached its daily limit. Please try again tomorrow." if exc.code == "daily_limit" else "You're going a little fast. Please wait a moment and try again."
        return _error(429, exc.code, message, {"Retry-After": str(exc.retry_after)})

    @app.exception_handler(AuthError)
    async def unauthorized(_: Request, __: AuthError):
        return _error(401, "unauthorized", "Please sign in again to use this feature.")

    @app.exception_handler(ProviderError)
    async def provider_down(_: Request, exc: ProviderError):
        log.warning("provider error: %s", exc)  # never includes keys or prompts
        return _error(502, "ai_unavailable", "The AI assistant is temporarily unavailable. Please try again.")

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception):
        log.exception("unexpected error: %s", type(exc).__name__)
        return _error(500, "server_error", "Something went wrong. Please try again.")

    @app.get("/health")
    async def health():
        return {"ok": True, "provider": provider.name}

    @app.post("/v1/describe", response_model=DescribeResponse, response_model_by_alias=True)
    async def describe(body: DescribeRequest, request: Request, authorization: str | None = Header(default=None)):
        ip = client_ip(request, settings.trust_proxy)
        limiter.check(f"describe-ip:{ip}", settings.rate_describe_per_hour * 3, 3600)
        if auth:
            uid = await auth.verify(authorization)
            limiter.check(f"describe-user:{uid}", settings.rate_describe_per_hour, 3600)
        budget.spend()
        return await describe_property(provider, body)

    @app.post("/v1/search/parse", response_model=SearchResponse)
    async def search_parse(body: SearchRequest, request: Request):
        limiter.check(f"search:{client_ip(request, settings.trust_proxy)}", settings.rate_search_per_minute, 60)
        budget.spend()
        filters, unsupported = await parse_search(provider, body.query)
        return SearchResponse(filters=filters, unsupported=unsupported)

    @app.post("/v1/concierge", response_model=ConciergeResponse, response_model_by_alias=True)
    async def concierge(body: ConciergeRequest, request: Request):
        limiter.check(f"concierge:{client_ip(request, settings.trust_proxy)}", settings.rate_concierge_per_minute, 60)
        budget.spend()
        result = await run_concierge(provider, body.messages)
        return ConciergeResponse(
            reply=result["reply"], follow_up_question=result["followUpQuestion"], ready=result["ready"],
            filters=result["filters"], unsupported=result["unsupported"],
        )

    return app


def app_factory() -> FastAPI:  # for: uvicorn app.main:app_factory --factory
    return create_app()
