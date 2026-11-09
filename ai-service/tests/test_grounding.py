from app.grounding import allowed_numbers, find_violations, reply_is_safe

from .conftest import FACTS


def test_numbers_from_facts_and_price_formats_are_allowed():
    ok = allowed_numbers(FACTS)
    for n in ("4", "3", "2800", "6", "24500000", "2.45", "245"):
        assert n in ok, n


def test_commas_and_word_numbers_are_normalised():
    assert find_violations(["Four bedrooms, 2,800 sq ft, Rs. 24,500,000"], FACTS) == []
    assert find_violations(["Five bedrooms"], FACTS)


def test_each_unlisted_feature_is_caught():
    for phrase in ("with a swimming pool", "walking distance to the school", "stunning mountain views", "newly built", "fully furnished", "has a lift", "great investment", "clear lalpurja", "modular kitchen", "with air conditioning"):
        assert find_violations([f"A house {phrase}."], FACTS), phrase


def test_listed_amenities_are_allowed():
    assert find_violations(["A house with parking and a garden."], FACTS) == []
    assert find_violations(["A house with a garden."], {**FACTS, "amenities": []})


def test_reply_safety():
    assert reply_is_safe("Thanks, I'll look for apartments in Kathmandu.", "apartment in Kathmandu")
    assert not reply_is_safe("We have a house for Rs. 90 lakh.", "a house")
    assert not reply_is_safe("There are 12 houses available.", "a house")
    assert not reply_is_safe("See https://evil.example", "a house")
    assert reply_is_safe("Budget of 1 crore noted.", "under 1 crore")
    assert not reply_is_safe("x" * 400, "x")
