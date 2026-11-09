import json

import httpx

from .base import Provider, ProviderError

DEFAULT_BASE = "https://api.openai.com"


class OpenAIProvider(Provider):
    name = "openai"

    def __init__(self, api_key: str, model: str, base_url: str | None = None, timeout: float = 25.0, transport: httpx.AsyncBaseTransport | None = None):
        self._key, self._model = api_key, model
        self._url = (base_url or DEFAULT_BASE).rstrip("/") + "/v1/chat/completions"
        self._client = httpx.AsyncClient(timeout=timeout, transport=transport)

    async def call(self, *, task, system, user, schema, schema_name, context):
        body = {
            "model": self._model,
            "temperature": 0.2,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_schema", "json_schema": {"name": schema_name, "strict": True, "schema": schema}},
        }
        headers = {"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"}
        try:
            resp = await self._client.post(self._url, json=body, headers=headers)
        except httpx.TimeoutException as e:
            raise ProviderError("openai timeout") from e
        except httpx.HTTPError as e:
            raise ProviderError("openai network error") from e
        if resp.status_code >= 400:
            raise ProviderError(f"openai returned HTTP {resp.status_code}")
        try:
            message = resp.json()["choices"][0]["message"]
        except (ValueError, KeyError, IndexError) as e:
            raise ProviderError("openai returned an unexpected response") from e
        if message.get("refusal"):
            raise ProviderError("openai declined the request")
        try:
            result = json.loads(message.get("content") or "")
        except ValueError as e:
            raise ProviderError("openai returned invalid JSON") from e
        if not isinstance(result, dict):
            raise ProviderError("openai returned an unexpected shape")
        return result

    async def aclose(self):
        await self._client.aclose()
