import httpx

from .base import Provider, ProviderError

DEFAULT_BASE = "https://api.anthropic.com"


class AnthropicProvider(Provider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str, base_url: str | None = None, timeout: float = 25.0, transport: httpx.AsyncBaseTransport | None = None):
        self._key, self._model = api_key, model
        self._url = (base_url or DEFAULT_BASE).rstrip("/") + "/v1/messages"
        self._client = httpx.AsyncClient(timeout=timeout, transport=transport)

    async def call(self, *, task, system, user, schema, schema_name, context):
        body = {
            "model": self._model,
            "max_tokens": 1200,
            "temperature": 0.2,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            # Forcing a tool call makes the model return JSON that matches the schema
            "tools": [{"name": schema_name, "description": "Return the result.", "input_schema": schema}],
            "tool_choice": {"type": "tool", "name": schema_name},
        }
        headers = {"x-api-key": self._key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        try:
            resp = await self._client.post(self._url, json=body, headers=headers)
        except httpx.TimeoutException as e:
            raise ProviderError("anthropic timeout") from e
        except httpx.HTTPError as e:
            raise ProviderError("anthropic network error") from e
        if resp.status_code >= 400:
            raise ProviderError(f"anthropic returned HTTP {resp.status_code}")
        try:
            data = resp.json()
            for block in data.get("content", []):
                if block.get("type") == "tool_use" and isinstance(block.get("input"), dict):
                    return block["input"]
        except ValueError as e:
            raise ProviderError("anthropic returned invalid JSON") from e
        raise ProviderError("anthropic returned no structured result")

    async def aclose(self):
        await self._client.aclose()
