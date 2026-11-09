from .conftest import FACTS, auth_transport, make_client

AUTHED = dict(require_auth=True, supabase_url="http://supabase.test", supabase_publishable_key="sb_publishable_test")


def test_describe_requires_a_valid_supabase_session():
    c = make_client(**AUTHED, auth_transport=auth_transport())
    assert c.post("/v1/describe", json=FACTS).status_code == 401
    assert c.post("/v1/describe", json=FACTS, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert c.post("/v1/describe", json=FACTS, headers={"Authorization": "Basic abc"}).status_code == 401
    ok = c.post("/v1/describe", json=FACTS, headers={"Authorization": "Bearer good"})
    assert ok.status_code == 200 and ok.json()["title"]


def test_session_check_uses_only_the_publishable_key_and_is_cached():
    calls = []
    c = make_client(**AUTHED, auth_transport=auth_transport(calls=calls))
    for _ in range(3):
        assert c.post("/v1/describe", json=FACTS, headers={"Authorization": "Bearer good"}).status_code == 200
    assert len(calls) == 1
    assert calls[0].headers["apikey"] == "sb_publishable_test" and str(calls[0].url) == "http://supabase.test/auth/v1/user"


def test_auth_service_outage_blocks_describe_instead_of_allowing_it():
    import httpx
    def boom(request):
        raise httpx.ConnectError("down")
    c = make_client(**AUTHED, auth_transport=httpx.MockTransport(boom))
    assert c.post("/v1/describe", json=FACTS, headers={"Authorization": "Bearer good"}).status_code == 401


def test_search_and_concierge_are_public():
    c = make_client(**AUTHED, auth_transport=auth_transport())
    assert c.post("/v1/search/parse", json={"query": "house in Kathmandu"}).status_code == 200
    assert c.post("/v1/concierge", json={"messages": [{"role": "user", "content": "a house"}]}).status_code == 200


def test_search_rate_limit_returns_429_with_retry_after():
    c = make_client(rate_search_per_minute=3)
    for _ in range(3):
        assert c.post("/v1/search/parse", json={"query": "house in Kathmandu"}).status_code == 200
    r = c.post("/v1/search/parse", json={"query": "house in Kathmandu"})
    assert r.status_code == 429 and int(r.headers["retry-after"]) >= 1 and r.json()["error"]["code"] == "rate_limited"
    assert c.post("/v1/concierge", json={"messages": [{"role": "user", "content": "a house"}]}).status_code == 200  # separate bucket


def test_describe_limit_is_per_user():
    c = make_client(**AUTHED, auth_transport=auth_transport(), rate_describe_per_hour=2)
    h = {"Authorization": "Bearer good"}
    assert [c.post("/v1/describe", json=FACTS, headers=h).status_code for _ in range(3)] == [200, 200, 429]


def test_daily_cap_bounds_total_provider_calls():
    c = make_client(daily_limit=2)
    codes = [c.post("/v1/search/parse", json={"query": "house in Kathmandu"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    assert c.post("/v1/search/parse", json={"query": "house in Kathmandu"}).json()["error"]["code"] == "daily_limit"


def test_cors_allows_only_the_configured_origin():
    c = make_client(allowed_origins=("https://estatehub.example",))
    ok = c.options("/v1/search/parse", headers={"Origin": "https://estatehub.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    assert ok.headers.get("access-control-allow-origin") == "https://estatehub.example"
    bad = c.options("/v1/search/parse", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


def test_oversized_body_is_rejected():
    c = make_client()
    r = c.post("/v1/search/parse", content=b'{"query":"' + b"a" * 30_000 + b'"}', headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_docs_and_openapi_are_not_exposed_and_health_leaks_nothing():
    c = make_client()
    assert c.get("/docs").status_code == 404 and c.get("/openapi.json").status_code == 404
    assert c.get("/health").json() == {"ok": True, "provider": "mock"}


def test_unexpected_errors_do_not_leak_internals():
    from app.providers.base import Provider

    class Broken(Provider):
        name = "broken"
        async def call(self, **kw):
            raise RuntimeError("secret internal detail /etc/passwd")

    c = make_client(Broken(), raise_server_exceptions=False)
    r = c.post("/v1/search/parse", json={"query": "house in Kathmandu"})
    assert r.status_code == 500 and "secret" not in r.text and "passwd" not in r.text
