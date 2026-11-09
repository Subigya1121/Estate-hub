"""JSON schemas given to the AI provider. All fields are required and nullable so they work in strict mode."""
from .catalog import LISTING_TYPES, PROPERTY_TYPES, SORTS


def _nullable(kind: str, enum=None) -> dict:
    d: dict = {"type": [kind, "null"]}
    if enum:
        d["enum"] = [*enum, None]
    return d


FILTERS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "purpose": _nullable("string", LISTING_TYPES),
        "type": _nullable("string", PROPERTY_TYPES),
        "category": _nullable("string"),
        "location": _nullable("string"),
        "amenity": _nullable("string"),
        "minPrice": _nullable("number"),
        "maxPrice": _nullable("number"),
        "bedrooms": _nullable("integer"),
        "bathrooms": _nullable("integer"),
        "sort": _nullable("string", SORTS),
    },
    "required": ["purpose", "type", "category", "location", "amenity", "minPrice", "maxPrice", "bedrooms", "bathrooms", "sort"],
}

_UNSUPPORTED = {"type": "array", "items": {"type": "string"}}

DESCRIBE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "highlights": {"type": "array", "items": {"type": "string"}},
        "seoDescription": {"type": "string"},
    },
    "required": ["title", "description", "highlights", "seoDescription"],
}

SEARCH_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {"filters": FILTERS_SCHEMA, "unsupportedCriteria": _UNSUPPORTED},
    "required": ["filters", "unsupportedCriteria"],
}

CONCIERGE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "filters": FILTERS_SCHEMA,
        "unsupportedCriteria": _UNSUPPORTED,
        "readyToSearch": {"type": "boolean"},
        "followUpQuestion": _nullable("string"),
        "reply": {"type": "string"},
    },
    "required": ["filters", "unsupportedCriteria", "readyToSearch", "followUpQuestion", "reply"],
}
