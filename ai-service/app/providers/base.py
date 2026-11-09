from abc import ABC, abstractmethod


class ProviderError(Exception):
    """The AI provider could not produce a usable answer. The message is safe to log (it never contains keys)."""


class Provider(ABC):
    name = "base"

    @abstractmethod
    async def call(self, *, task: str, system: str, user: str, schema: dict, schema_name: str, context: dict) -> dict:
        """Return an object matching `schema`. `context` is used only by the offline mock provider."""
