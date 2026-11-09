from .. import rules
from ..drafts import template_draft
from .base import Provider

FILTER_KEYS = ("purpose", "type", "category", "location", "amenity", "minPrice", "maxPrice", "bedrooms", "bathrooms", "sort")


def _full(filters: dict) -> dict:
    return {k: filters.get(k) for k in FILTER_KEYS}


class MockProvider(Provider):
    """Offline stand-in for development and tests. It makes no network calls and uses no AI."""

    name = "mock"

    async def call(self, *, task, system, user, schema, schema_name, context):
        if task == "describe":
            return template_draft(context["facts"])
        if task == "search":
            f, unsupported = rules.parse_query(context["query"])
            return {"filters": _full(f), "unsupportedCriteria": unsupported}
        if task == "concierge":
            text = " ".join(context["user_messages"])
            f, unsupported = rules.parse_query(text)
            ready = bool(f.get("purpose") and (f.get("type") or f.get("location")))
            return {
                "filters": _full(f),
                "unsupportedCriteria": unsupported,
                "readyToSearch": ready,
                "followUpQuestion": None if ready else "Are you looking to buy or to rent?",
                "reply": "Thanks, I'll look for properties that fit what you've told me." if ready else "Thanks. Let me ask one more thing.",
            }
        raise ValueError(f"Unknown task {task}")
