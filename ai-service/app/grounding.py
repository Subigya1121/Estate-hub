"""Checks that generated text does not contain facts the owner never provided.

The AI is told to use only the facts. These checks do not rely on that: they look at the output and reject
anything that mentions a number or a property feature that is not in the facts.
"""
import re

NUMBER_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
NUMBER_WORDS = {
    "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "twenty": "20", "thirty": "30", "forty": "40", "fifty": "50", "hundred": "100",
}
NUMBER_WORD_RE = re.compile(r"\b(" + "|".join(NUMBER_WORDS) + r")\b", re.I)


def norm_number(raw: str) -> str:
    s = raw.replace(",", "").strip(".")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s.lstrip("0") or "0"


def numbers_in(text: str) -> set[str]:
    found = {norm_number(m) for m in NUMBER_RE.findall(text)}
    found |= {NUMBER_WORDS[m.lower()] for m in NUMBER_WORD_RE.findall(text)}
    return found


def _variants(value: float) -> set[str]:
    out = {norm_number(f"{value:.2f}")}
    out.add(norm_number(str(int(value))) if float(value).is_integer() else norm_number(f"{value:.2f}"))
    return out


def allowed_numbers(facts: dict) -> set[str]:
    allowed: set[str] = set()
    for key in ("bedrooms", "bathrooms", "area_sqft", "land_area_aana"):
        if facts.get(key) is not None:
            allowed |= _variants(float(facts[key]))
    price = facts.get("price_npr")
    if price is not None:
        price = float(price)
        allowed |= _variants(price)
        allowed |= _variants(round(price / 10_000_000, 2))  # crore
        allowed |= _variants(round(price / 100_000, 2))     # lakh
        allowed |= _variants(round(price / 1000, 2))        # thousands (e.g. 28k)
    for key in ("additional_details", "road_access", "category", "location", "city"):
        if facts.get(key):
            allowed |= numbers_in(str(facts[key]))
    return allowed


# (name, pattern): something a listing can only claim if the owner provided it
FEATURE_CLAIMS = (
    ("parking", r"\b(parking|garage|car ?port)\b"),
    ("garden", r"\b(garden|lawn|backyard|courtyard)\b"),
    ("balcony or terrace", r"\b(balcon(?:y|ies)|terrace|rooftop|roof[- ]top)\b"),
    ("solar", r"\bsolar\b"),
    ("security", r"\b(security|cctv|gated|guard|guarded)\b"),
    ("internet", r"\b(internet|wi-?fi|fib(?:re|er))\b"),
    ("water supply", r"\b(water|borewell|tank)\b"),
    ("electricity", r"\b(electricity|power|generator|backup)\b"),
    ("road access", r"\b(road|street|lane|highway|blacktop(?:ped)?)\b"),
    ("lift", r"\b(lift|elevator)\b"),
    ("pool or gym", r"\b(swimming pool|pool|gym|fitness)\b"),
    ("furnishing", r"\b(?:un|semi-?)?furnished\b|\bfurnishings?\b"),
    ("kitchen type", r"\bmodular kitchen\b"),
    ("climate control", r"\b(air[- ]conditioning|air[- ]conditioned|heating|fireplace)\b"),
    ("views", r"\b(views?|panoramic|mountain|himalaya\w*)\b"),
    ("proximity", r"\b(near|nearby|close to|walking distance|minutes? (?:from|to|away)|steps from|proximity)\b"),
    ("nearby places", r"\b(schools?|hospitals?|markets?|airport|universit(?:y|ies)|campus|temple|metro)\b"),
    ("condition or age", r"\b(renovated|newly (?:built|constructed)|brand[- ]new|recently built|under construction|ready to move|move-in ready)\b"),
    ("legal status", r"\b(lalpurja|clear title|freehold|ownership|titled)\b"),
    ("investment claim", r"\b(investment|rental income|high returns?|appreciation)\b"),
)
_COMPILED = tuple((name, re.compile(p, re.I)) for name, p in FEATURE_CLAIMS)


def evidence_text(facts: dict) -> str:
    parts = list(facts.get("amenities") or []) + [facts.get(k) or "" for k in ("additional_details", "road_access", "category", "location", "city")]
    text = " ".join(str(p) for p in parts).lower()
    # a listed amenity is evidence for its own wording
    if "Road Access" in (facts.get("amenities") or []):
        text += " road street"
    if "Water Supply" in (facts.get("amenities") or []):
        text += " water"
    if "Electricity" in (facts.get("amenities") or []):
        text += " electricity power"
    return text


def find_violations(texts: list[str], facts: dict) -> list[str]:
    """Return human-readable problems found in `texts` (title, description, highlights...)."""
    joined = " \n ".join(t for t in texts if t)
    problems: list[str] = []
    allowed = allowed_numbers(facts)
    for n in sorted(numbers_in(joined)):
        if n not in allowed:
            problems.append(f"the number {n} isn't in the listing facts")
    evidence = evidence_text(facts)
    for name, rx in _COMPILED:
        match = rx.search(joined)
        if match and not rx.search(evidence):
            problems.append(f"it mentions {name} (\"{match.group(0)}\"), which the owner didn't provide")
    return problems


CURRENCY_RE = re.compile(r"\b(rs\.?|npr|nrs\.?|crore|lakh|lakhs)\b|₹", re.I)
URL_RE = re.compile(r"https?://|www\.", re.I)


def reply_is_safe(text: str, user_text: str) -> bool:
    """A chat reply may restate the customer's own words but must not introduce figures, prices or links."""
    if not text or len(text) > 320 or URL_RE.search(text):
        return False
    if numbers_in(text) - numbers_in(user_text):
        return False
    if CURRENCY_RE.search(text) and not CURRENCY_RE.search(user_text):
        return False
    return True
