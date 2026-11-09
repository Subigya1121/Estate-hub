import re
import unicodedata

from .catalog import AMENITIES, COMMERCIAL_CATEGORIES, LAND_CATEGORIES, LOCATIONS, LISTING_TYPES, PROPERTY_TYPES, SORTS
from .rules import explicit_location
from .drafts import format_price, template_draft
from .grounding import find_violations, reply_is_safe
from .prompts import CONCIERGE_SYSTEM, DESCRIBE_SYSTEM, SEARCH_SYSTEM
from .providers import Provider, ProviderError
from .schemas import ChatMessage, DescribeRequest, DescribeResponse
from .schemas_ai import CONCIERGE_SCHEMA, DESCRIBE_SCHEMA, SEARCH_SCHEMA

TAG_RE = re.compile(r"[<>]")
CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def clean_text(value: str, limit: int) -> str:
    """Make text safe to embed in a prompt: no tag characters or control characters, bounded length."""
    return CTRL_RE.sub(" ", TAG_RE.sub(" ", value)).strip()[:limit]


# ------------------------------------------------------------------ describe
def _facts_block(facts: dict) -> str:
    lines = [
        f"Listing type: {'for rent' if facts['listing_type'] == 'rent' else 'for sale'}",
        f"Property type: {facts['property_type']}",
    ]
    if facts.get("category"):
        lines.append(f"Category: {clean_text(facts['category'], 60)}")
    place = facts["location"] + (f", {facts['city']}" if facts.get("city") and facts["city"] != facts["location"] else "")
    lines.append(f"Location: {clean_text(place, 160)}")
    lines.append(f"Price: {format_price(float(facts['price_npr']), facts.get('price_unit', 'total'))}")
    for key, label in (("bedrooms", "Bedrooms"), ("bathrooms", "Bathrooms"), ("area_sqft", "Built-up or plot area (sq ft)"), ("land_area_aana", "Land area (aana)")):
        if facts.get(key) is not None:
            lines.append(f"{label}: {facts[key]}")
    if facts.get("road_access"):
        lines.append(f"Road access: {clean_text(facts['road_access'], 120)}")
    lines.append("Amenities: " + (", ".join(facts["amenities"]) if facts.get("amenities") else "none listed"))
    block = "<facts>\n" + "\n".join(lines) + "\n</facts>"
    if facts.get("additional_details"):
        block += "\n<owner_notes>\n" + clean_text(facts["additional_details"], 1000) + "\n</owner_notes>"
    return block


def _draft_texts(d: dict) -> list[str]:
    return [d["title"], d["description"], *d["highlights"], d["seoDescription"]]


def _tidy(raw: dict) -> dict | None:
    """Validate the provider output shape and normalise it. None means unusable."""
    try:
        title = str(raw["title"]).strip()
        description = str(raw["description"]).strip()
        highlights = [str(h).strip() for h in raw["highlights"] if str(h).strip()]
        seo = str(raw["seoDescription"]).strip()
    except (KeyError, TypeError):
        return None
    if not title or not description:
        return None
    strip_md = lambda s: re.sub(r"[*_`#]+", "", s)
    return {
        "title": strip_md(title)[:80],
        "description": strip_md(description)[:1200],
        "highlights": [strip_md(h)[:80] for h in highlights][:6],
        "seoDescription": strip_md(seo)[:160],
    }


async def describe_property(provider: Provider, req: DescribeRequest) -> DescribeResponse:
    facts = req.model_dump()
    user = _facts_block(facts)
    feedback = ""
    for attempt in range(2):
        raw = await provider.call(
            task="describe", system=DESCRIBE_SYSTEM, user=user + feedback,
            schema=DESCRIBE_SCHEMA, schema_name="listing_draft", context={"facts": facts},
        )
        draft = _tidy(raw)
        if draft is None:
            feedback = "\n\nYour previous answer was incomplete. Provide a title, a description, highlights and an seoDescription."
            continue
        problems = find_violations(_draft_texts(draft), facts)
        if not problems:
            return DescribeResponse(**{**draft, "seo_description": draft["seoDescription"]}, warnings=[], source="ai")
        feedback = "\n\nYour previous draft was rejected because " + "; ".join(problems[:5]) + ". Rewrite it using only the facts above."
    safe = template_draft(facts)
    return DescribeResponse(
        title=safe["title"], description=safe["description"], highlights=safe["highlights"], seo_description=safe["seoDescription"],
        warnings=["The AI draft included details that were not in your listing, so a plain draft built only from your facts is shown instead. Edit it as you like."],
        source="template",
    )


# ------------------------------------------------------------------ filters
def _ci(value, options):
    if not isinstance(value, str):
        return None
    for o in options:
        if o.lower() == value.strip().lower():
            return o
    return None


def _int(value, lo, hi):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    n = int(value)
    return n if lo <= n <= hi else None


def sanitize_filters(raw: object, unsupported: list[str]) -> dict:
    """Keep only values EstateHub's search understands. Anything else is dropped (and reported when useful)."""
    raw = raw if isinstance(raw, dict) else {}
    out: dict = {}
    if (purpose := _ci(raw.get("purpose"), LISTING_TYPES)):
        out["purpose"] = purpose
    if (ptype := _ci(raw.get("type"), PROPERTY_TYPES)):
        out["type"] = ptype
    cat = _ci(raw.get("category"), (*COMMERCIAL_CATEGORIES, *LAND_CATEGORIES))
    if cat in COMMERCIAL_CATEGORIES:
        if out.get("type") in (None, "commercial"):
            out["type"], out["category"] = "commercial", cat
    elif cat in LAND_CATEGORIES:
        if out.get("type") in (None, "land"):
            out["type"], out["category"] = "land", cat
    place = raw.get("location")
    if isinstance(place, str) and place.strip():
        candidate = clean_text(place, 80).strip()
        canonical = _ci(candidate, LOCATIONS)
        # Free-text location is data, but it must remain a single bounded place name.
        if 2 <= len(candidate) <= 80 and all(
            unicodedata.category(char)[0] in "LMN" or char in " .'-’"
            for char in candidate
        ):
            out["location"] = canonical or candidate
        else:
            unsupported.append("an unclear location")
    amen = raw.get("amenity")
    if isinstance(amen, str) and amen.strip():
        if (a := _ci(amen, AMENITIES)):
            out["amenity"] = a
        else:
            unsupported.append(f"amenity “{clean_text(amen, 40)}”")
    for key in ("minPrice", "maxPrice"):
        v = raw.get(key)
        if isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 100_000_000_000:
            out[key] = int(v)
    if "minPrice" in out and "maxPrice" in out and out["minPrice"] > out["maxPrice"]:
        del out["minPrice"]
    for key in ("bedrooms", "bathrooms"):
        n = _int(raw.get(key), 0, 10)
        if n:
            out[key] = n
    if (sort := _ci(raw.get("sort"), SORTS)):
        out["sort"] = sort
    return out


def _unsupported(raw: object, extra: list[str]) -> list[str]:
    items = [clean_text(x, 80) for x in (raw if isinstance(raw, list) else []) if isinstance(x, str) and x.strip()]
    seen, out = set(), []
    for x in [*items, *extra]:
        if x and x.lower() not in seen:
            seen.add(x.lower())
            out.append(x)
    return out[:5]


async def parse_search(provider: Provider, query: str) -> tuple[dict, list[str]]:
    q = clean_text(query, 500)
    raw = await provider.call(
        task="search", system=SEARCH_SYSTEM, user=f"<request>\n{q}\n</request>",
        schema=SEARCH_SCHEMA, schema_name="search_filters", context={"query": q},
    )
    extra: list[str] = []
    filters = sanitize_filters(raw.get("filters") if isinstance(raw, dict) else None, extra)
    if place := explicit_location(q):
        filters.update(sanitize_filters({"location": place}, extra))
    return filters, _unsupported(raw.get("unsupportedCriteria") if isinstance(raw, dict) else None, extra)


# ------------------------------------------------------------------ concierge
def describe_filters(f: dict) -> str:
    parts = []
    if f.get("purpose"):
        parts.append("to buy" if f["purpose"] == "sale" else "to rent")
    if f.get("bedrooms"):
        parts.append(f"{f['bedrooms']}+ bedrooms")
    if f.get("type"):
        parts.append(f["type"])
    if f.get("location"):
        parts.append(f"in {f['location']}")
    if f.get("amenity"):
        parts.append(f"with {f['amenity'].lower()}")
    if f.get("maxPrice"):
        parts.append(f"up to Rs. {f['maxPrice']:,}")
    if f.get("minPrice"):
        parts.append(f"from Rs. {f['minPrice']:,}")
    return " ".join(parts)


def next_question(f: dict) -> str:
    if not f:
        return "What kind of property are you looking for: a house, apartment, land or commercial space?"
    if not f.get("purpose") and f.get("type") != "land":
        return "Are you looking to buy or to rent?"
    if not f.get("type") and not f.get("location"):
        return "What kind of property are you looking for: a house, apartment, land or commercial space?"
    return "Which area would you like to search in?"


async def run_concierge(provider: Provider, messages: list[ChatMessage]) -> dict:
    messages = messages[-10:]
    user_texts = [m.content for m in messages if m.role == "user"]
    transcript = "\n".join(f"{'Customer' if m.role == 'user' else 'Assistant'}: {clean_text(m.content, 500)}" for m in messages)
    raw = await provider.call(
        task="concierge", system=CONCIERGE_SYSTEM, user=f"<conversation>\n{transcript}\n</conversation>",
        schema=CONCIERGE_SCHEMA, schema_name="concierge_turn",
        context={"user_messages": [clean_text(t, 500) for t in user_texts]},
    )
    raw = raw if isinstance(raw, dict) else {}
    extra: list[str] = []
    filters = sanitize_filters(raw.get("filters"), extra)
    explicit_places = (explicit_location(text) for text in reversed(user_texts))
    if place := next((place for place in explicit_places if place), None):
        filters.update(sanitize_filters({"location": place}, extra))
    unsupported = _unsupported(raw.get("unsupportedCriteria"), extra)
    location_unclear = any("unclear location" in item.lower() for item in unsupported)

    # Readiness is decided here, not by the AI, so the conversation can never loop forever
    questions_asked = sum(1 for m in messages if m.role == "assistant" and m.content.strip().endswith("?"))
    core = bool((filters.get("purpose") or filters.get("type") == "land") and (filters.get("type") or filters.get("location")))
    ready = not location_unclear and (core or (questions_asked >= 2 and bool(filters)))

    user_blob = " ".join(user_texts)
    reply = raw.get("reply") if isinstance(raw.get("reply"), str) else ""
    if not reply_is_safe(reply, user_blob):
        summary = describe_filters(filters)
        reply = f"Here's what I understood: {summary}." if summary else "Thanks. I need a little more detail to help."
    follow_up = None
    if not ready:
        q = raw.get("followUpQuestion") if isinstance(raw.get("followUpQuestion"), str) else ""
        if location_unclear:
            follow_up = "Which specific district, city or locality should I search?"
        else:
            follow_up = q.strip() if (filters and q.strip().endswith("?") and len(q) <= 200 and reply_is_safe(q, user_blob)) else next_question(filters)
    return {"reply": reply, "followUpQuestion": follow_up, "ready": ready, "filters": filters, "unsupported": unsupported}


__all__ = ["describe_property", "parse_search", "run_concierge", "sanitize_filters", "ProviderError"]
