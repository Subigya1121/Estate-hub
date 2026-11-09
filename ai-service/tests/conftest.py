import warnings

import httpx
import pytest
from fastapi.testclient import TestClient

warnings.filterwarnings("ignore", category=DeprecationWarning)

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.providers.base import Provider, ProviderError  # noqa: E402

FACTS = {
    "listing_type": "sale", "property_type": "house", "location": "Bhaisepati", "city": "Lalitpur",
    "price_npr": 24500000, "price_unit": "total", "bedrooms": 4, "bathrooms": 3, "area_sqft": 2800,
    "land_area_aana": 6, "amenities": ["Parking", "Garden"], "additional_details": "Quiet lane.",
}


class ScriptedProvider(Provider):
    """Returns canned outputs in order, recording every call (to inspect prompts)."""

    name = "scripted"

    def __init__(self, *outputs):
        self.outputs, self.calls = list(outputs), []

    async def call(self, **kwargs):
        self.calls.append(kwargs)
        out = self.outputs.pop(0) if len(self.outputs) > 1 else self.outputs[0]
        if isinstance(out, Exception):
            raise out
        return out


@pytest.fixture
def settings():
    return Settings(provider="mock", require_auth=False)


@pytest.fixture
def client(settings):
    return TestClient(create_app(settings))


def make_client(provider=None, auth_transport=None, raise_server_exceptions=True, **overrides):
    base = dict(provider="mock", require_auth=False)
    base.update(overrides)
    app = create_app(Settings(**base), provider=provider, auth_transport=auth_transport)
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def auth_transport(valid="good", calls=None):
    def handler(request: httpx.Request):
        if calls is not None:
            calls.append(request)
        if request.url.path == "/auth/v1/user" and request.headers.get("authorization") == f"Bearer {valid}" and request.headers.get("apikey"):
            return httpx.Response(200, json={"id": "user-1"})
        return httpx.Response(401, json={"msg": "invalid"})

    return httpx.MockTransport(handler)


__all__ = ["FACTS", "ScriptedProvider", "ProviderError", "make_client", "auth_transport"]
