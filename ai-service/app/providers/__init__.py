import httpx

from ..config import Settings
from .anthropic import AnthropicProvider
from .base import Provider, ProviderError
from .mock import MockProvider
from .openai import OpenAIProvider

__all__ = ["Provider", "ProviderError", "get_provider"]


def get_provider(settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> Provider:
    if settings.provider == "mock":
        return MockProvider()
    cls = AnthropicProvider if settings.provider == "anthropic" else OpenAIProvider
    return cls(settings.api_key, settings.model, settings.base_url, settings.request_timeout_s, transport)
