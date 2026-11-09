import asyncio
import json

import httpx
import pytest

from app.config import ConfigError, Settings
from app.providers.anthropic import AnthropicProvider
from app.providers.base import ProviderError
from app.providers.openai import OpenAIProvider
from app.schemas_ai import SEARCH_SCHEMA

CALL = dict(task="search", system="SYS", user="USER TEXT", schema=SEARCH_SCHEMA, schema_name="search_filters", context={})
RESULT = {"filters": {"purpose": "rent"}, "unsupportedCriteria": []}


def run(coro):
    return asyncio.run(coro)


def test_anthropic_request_shape_and_tool_result_parsing():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["headers"], seen["body"] = str(request.url), request.headers, json.loads(request.content)
        return httpx.Response(200, json={"content": [{"type": "text", "text": "hi"}, {"type": "tool_use", "name": "search_filters", "input": RESULT}]})

    p = AnthropicProvider("sk-test-key", "model-x", transport=httpx.MockTransport(handler))
    assert run(p.call(**CALL)) == RESULT
    assert seen["url"] == "https://api.anthropic.com/v1/messages"
    assert seen["headers"]["x-api-key"] == "sk-test-key" and seen["headers"]["anthropic-version"] == "2023-06-01"
    b = seen["body"]
    assert b["model"] == "model-x" and b["system"] == "SYS" and b["messages"] == [{"role": "user", "content": "USER TEXT"}]
    assert b["tool_choice"] == {"type": "tool", "name": "search_filters"} and b["tools"][0]["input_schema"] == SEARCH_SCHEMA


def test_openai_request_shape_and_json_parsing():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["headers"], seen["body"] = str(request.url), request.headers, json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(RESULT)}}]})

    p = OpenAIProvider("sk-test-key", "model-y", transport=httpx.MockTransport(handler))
    assert run(p.call(**CALL)) == RESULT
    assert seen["url"] == "https://api.openai.com/v1/chat/completions" and seen["headers"]["authorization"] == "Bearer sk-test-key"
    rf = seen["body"]["response_format"]
    assert rf["type"] == "json_schema" and rf["json_schema"]["strict"] is True and rf["json_schema"]["schema"] == SEARCH_SCHEMA
    assert [m["role"] for m in seen["body"]["messages"]] == ["system", "user"]


@pytest.mark.parametrize("cls", [AnthropicProvider, OpenAIProvider])
def test_provider_failures_become_safe_provider_errors(cls):
    for status in (400, 401, 429, 500, 529):
        p = cls("sk-SECRET-123", "m", transport=httpx.MockTransport(lambda r, s=status: httpx.Response(s, json={"error": {"message": "echo sk-SECRET-123"}})))
        with pytest.raises(ProviderError) as e:
            run(p.call(**CALL))
        assert "SECRET" not in str(e.value) and str(status) in str(e.value)

    def timeout(request):
        raise httpx.ReadTimeout("slow")

    with pytest.raises(ProviderError, match="timeout"):
        run(cls("k", "m", transport=httpx.MockTransport(timeout)).call(**CALL))


def test_provider_garbage_responses_are_errors():
    bad_a = AnthropicProvider("k", "m", transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"content": [{"type": "text", "text": "no tool"}]})))
    with pytest.raises(ProviderError):
        run(bad_a.call(**CALL))
    for body in ({"choices": []}, {"choices": [{"message": {"content": "not json"}}]}, {"choices": [{"message": {"content": "[1,2]"}}]}, {"choices": [{"message": {"refusal": "no", "content": None}}]}):
        p = OpenAIProvider("k", "m", transport=httpx.MockTransport(lambda r, b=body: httpx.Response(200, json=b)))
        with pytest.raises(ProviderError):
            run(p.call(**CALL))


def test_settings_validation():
    with pytest.raises(ConfigError, match="AI_API_KEY"):
        Settings.from_env({"AI_PROVIDER": "anthropic", "AI_REQUIRE_AUTH": "false"})
    with pytest.raises(ConfigError, match="AI_PROVIDER"):
        Settings.from_env({"AI_PROVIDER": "nope", "AI_REQUIRE_AUTH": "false"})
    with pytest.raises(ConfigError, match="SUPABASE_URL"):
        Settings.from_env({"AI_PROVIDER": "mock"})
    with pytest.raises(ConfigError, match="secret key"):
        Settings.from_env({"AI_PROVIDER": "mock", "SUPABASE_URL": "https://x.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "sb_secret_abc"})
    with pytest.raises(ConfigError):
        Settings.from_env({"AI_PROVIDER": "mock", "AI_REQUIRE_AUTH": "false", "RATE_SEARCH_PER_MINUTE": "0"})
    s = Settings.from_env({"AI_PROVIDER": "openai", "AI_API_KEY": "sk-abc", "AI_MODEL": "m", "AI_REQUIRE_AUTH": "false", "ALLOWED_ORIGINS": "https://a.example, https://b.example"})
    assert s.allowed_origins == ("https://a.example", "https://b.example") and "sk-abc" not in repr(s)


def test_get_provider_selects_the_right_adapter():
    from app.providers import get_provider
    assert get_provider(Settings(provider="mock", require_auth=False)).name == "mock"
    assert get_provider(Settings(provider="anthropic", api_key="k", model="m", require_auth=False)).name == "anthropic"
    assert get_provider(Settings(provider="openai", api_key="k", model="m", require_auth=False)).name == "openai"
