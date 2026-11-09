"""Plain, fact-only listing text. Used by the mock provider and as the safe fallback when an AI draft
contains details the owner never provided."""

TYPE_LABEL = {"house": "house", "apartment": "apartment", "land": "plot of land", "commercial": "commercial property"}


def _trim(x: float) -> str:
    return f"{x:.2f}".rstrip("0").rstrip(".")


def format_price(amount: float, unit: str = "total") -> str:
    if unit == "month":
        return f"Rs. {int(amount):,} per month"
    if amount >= 10_000_000:
        base = f"Rs. {_trim(amount / 10_000_000)} Crore"
    elif amount >= 100_000:
        base = f"Rs. {_trim(amount / 100_000)} Lakh"
    else:
        base = f"Rs. {int(amount):,}"
    return f"{base} per aana" if unit == "aana" else base


def _place(facts: dict) -> str:
    loc, city = facts["location"], facts.get("city")
    return f"{loc}, {city}" if city and city != loc else loc


def _num(x) -> str:
    return _trim(float(x))


def fact_lines(facts: dict) -> list[str]:
    lines = []
    if facts.get("bedrooms"):
        lines.append(f"{facts['bedrooms']} bedroom{'s' if facts['bedrooms'] != 1 else ''}")
    if facts.get("bathrooms"):
        lines.append(f"{facts['bathrooms']} bathroom{'s' if facts['bathrooms'] != 1 else ''}")
    if facts.get("area_sqft"):
        lines.append(f"{float(facts['area_sqft']):,.0f} sq ft")
    if facts.get("land_area_aana"):
        lines.append(f"{_num(facts['land_area_aana'])} aana of land")
    if facts.get("road_access"):
        lines.append(f"Road access: {facts['road_access']}")
    for a in facts.get("amenities") or []:
        lines.append(a)
    return lines


def template_draft(facts: dict) -> dict:
    kind = TYPE_LABEL[facts["property_type"]]
    cat = (facts.get("category") or "").lower()
    if facts["property_type"] == "commercial" and cat:
        kind = cat
    listing = "for rent" if facts["listing_type"] == "rent" else "for sale"
    place = _place(facts)
    price = format_price(float(facts["price_npr"]), facts.get("price_unit", "total"))
    title = f"{kind.capitalize()} {listing} in {facts['location']}"[:80]

    p1 = f"This {kind} is {listing} in {place}. The price is {price}."
    details = []
    if facts.get("bedrooms") or facts.get("bathrooms"):
        parts = [x for x in (
            f"{facts['bedrooms']} bedroom{'s' if facts['bedrooms'] != 1 else ''}" if facts.get("bedrooms") else None,
            f"{facts['bathrooms']} bathroom{'s' if facts['bathrooms'] != 1 else ''}" if facts.get("bathrooms") else None,
        ) if x]
        details.append("It has " + " and ".join(parts) + ".")
    if facts.get("area_sqft"):
        details.append(f"The area is {float(facts['area_sqft']):,.0f} sq ft.")
    if facts.get("land_area_aana"):
        details.append(f"The land area is {_num(facts['land_area_aana'])} aana.")
    if facts.get("road_access"):
        details.append(f"Road access: {facts['road_access']}.")
    paragraphs = [p1]
    if details:
        paragraphs.append(" ".join(details))
    if facts.get("amenities"):
        paragraphs.append("Listed amenities: " + ", ".join(a.lower() for a in facts["amenities"]) + ".")
    notes = (facts.get("additional_details") or "").strip()
    if notes:
        paragraphs.append(notes)

    highlights = fact_lines(facts)[:6] or [f"{kind.capitalize()} in {facts['location']}"]
    seo = f"{kind.capitalize()} {listing} in {place}. {price}."[:155]
    return {"title": title, "description": "\n\n".join(paragraphs)[:1200], "highlights": highlights, "seoDescription": seo}
