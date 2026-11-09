"""Plain keyword/regex understanding of a search request.

Used by the offline 'mock' provider, so development and tests need no API key. It is deliberately simple
and is NOT what runs in production when a real AI provider is configured.
"""
import re

from .catalog import AMENITIES, COMMERCIAL_CATEGORIES, LAND_CATEGORIES, LOCATIONS

UNITS = {"crore": 10_000_000, "cr": 10_000_000, "lakh": 100_000, "lac": 100_000, "lakhs": 100_000, "thousand": 1000, "k": 1000}

TYPE_WORDS = (
    ("land", r"\b(land|plot|plots)\b"),
    ("apartment", r"\b(apartment|apartments|flat|flats|bhk|room|rooms)\b"),
    ("commercial", r"\b(commercial|shop|shops|showroom|office|offices|restaurant)\b"),
    ("house", r"\b(house|houses|home|homes|villa|bungalow)\b"),
)
UNSUPPORTED = (
    (r"\b(near|nearby|close to|walking distance|next to|around the corner)\b[^,.]*", "proximity to a place"),
    (r"\b(furnished|semi-furnished)\b", "furnishing"),
    (r"\b(view|views|mountain view)\b", "views"),
    (r"\b(new|newly built|brand new|renovated)\b", "building age or condition"),
)


def _money(text: str, lead: str) -> float | None:
    m = re.search(lead + r"\s*(?:around|about|approx\.?|roughly)?\s*(?:rs\.?|npr|nrs\.?)?\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakhs?|lac|thousand|k)?", text, re.I)
    if not m:
        return None
    value = float(m.group(1).replace(",", ""))
    return value * UNITS.get((m.group(2) or "").lower(), 1)


def explicit_location(text: str) -> str | None:
    """Extract a plainly stated place so provider output cannot replace it with another location."""
    place = re.search(r"\b(?:in|at|around)\s+([^.;!?]+)", text, re.I)
    if not place:
        return None
    candidate = re.split(
        r"\b(?:under|below|less than|within|up to|upto|over|above|with|and|for|to buy|to rent)\b",
        place.group(1), maxsplit=1, flags=re.I,
    )[0].strip(" \t\r\n\"'“”,")
    if candidate.lower().startswith("the "):
        candidate = candidate[4:]
    return candidate if 2 <= len(candidate) <= 80 else None


def parse_query(text: str) -> tuple[dict, list[str]]:
    t = text.lower()
    f: dict = {}
    unsupported: list[str] = []

    for name, pattern in TYPE_WORDS:
        if re.search(pattern, t):
            f["type"] = name
            break
    if location := explicit_location(text):
        f["location"] = location
    for cat in (*COMMERCIAL_CATEGORIES, *LAND_CATEGORIES):
        if re.search(rf"\b{cat.lower()}\b", t) and cat != "Commercial land":
            f["category"] = cat
            break
    if re.search(r"\b(office|offices)\b", t):
        f["category"] = "Office"
    elif re.search(r"\b(shop|shops)\b", t):
        f["category"] = "Shop"

    m = re.search(r"(\d+)[\s-]*(?:bed|bhk|bedroom)", t)
    if m:
        f["bedrooms"] = int(m.group(1))
    else:
        words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
        m = re.search(r"\b(one|two|three|four|five)[\s-]*(?:bed|bhk|bedroom)", t)
        if m:
            f["bedrooms"] = words[m.group(1)]
    m = re.search(r"(\d+)[\s-]*bath", t)
    if m:
        f["bathrooms"] = int(m.group(1))

    mx = _money(t, r"(?:under|below|less than|within|upto|up to|max|maximum|budget(?: of)?|around|about)")
    if mx is not None:
        f["maxPrice"] = int(mx)
    mn = _money(t, r"(?:above|over|more than|at least|minimum|min)")
    if mn is not None:
        f["minPrice"] = int(mn)

    if re.search(r"\b(rent|rental|rentals|monthly|per month|/month|lease)\b", t):
        f["purpose"] = "rent"
    elif re.search(r"\b(buy|purchase|for sale|sale)\b", t) or f.get("type") == "land":
        f["purpose"] = "sale"
    elif f.get("maxPrice", 0) >= 1_000_000:
        f["purpose"] = "sale"

    for amenity in AMENITIES:
        if amenity.lower() in t:
            f["amenity"] = amenity
            break
    if re.search(r"\bcheapest|lowest price|low to high\b", t):
        f["sort"] = "price-asc"
    elif re.search(r"\bmost expensive|high to low\b", t):
        f["sort"] = "price-desc"
    elif re.search(r"\b(newest|latest|recent)\b", t):
        f["sort"] = "newest"

    for pattern, label in UNSUPPORTED:
        mm = re.search(pattern, t)
        if mm:
            snippet = mm.group(0).strip()
            unsupported.append(snippet[:60] if label == "proximity to a place" else label)
    return f, unsupported
