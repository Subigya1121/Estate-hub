from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .catalog import AMENITIES

PriceUnit = Literal["total", "month", "aana"]


class DescribeRequest(BaseModel):
    """Facts entered by the listing owner. Everything the AI may use is in here."""

    model_config = ConfigDict(extra="forbid")

    listing_type: Literal["sale", "rent"]
    property_type: Literal["house", "apartment", "land", "commercial"]
    category: str | None = Field(default=None, max_length=60)
    location: str = Field(min_length=2, max_length=80)
    city: str | None = Field(default=None, max_length=80)
    price_npr: float = Field(gt=0, le=100_000_000_000)
    price_unit: PriceUnit = "total"
    bedrooms: int | None = Field(default=None, ge=0, le=50)
    bathrooms: int | None = Field(default=None, ge=0, le=50)
    area_sqft: float | None = Field(default=None, gt=0, le=10_000_000)
    land_area_aana: float | None = Field(default=None, gt=0, le=100_000)
    road_access: str | None = Field(default=None, max_length=120)
    amenities: list[str] = Field(default_factory=list, max_length=20)
    additional_details: str | None = Field(default=None, max_length=1000)

    @field_validator("amenities")
    @classmethod
    def known_amenities(cls, value: list[str]) -> list[str]:
        bad = [a for a in value if a not in AMENITIES]
        if bad:
            raise ValueError(f"Unknown amenities: {', '.join(bad[:3])}")
        return list(dict.fromkeys(value))


class DescribeResponse(BaseModel):
    title: str
    description: str
    highlights: list[str]
    seo_description: str = Field(serialization_alias="seoDescription")
    warnings: list[str] = []
    source: Literal["ai", "template"] = "ai"

    model_config = ConfigDict(populate_by_name=True)


class SearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=3, max_length=500)


class SearchResponse(BaseModel):
    filters: dict
    unsupported: list[str] = []


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=500)



class ConciergeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[ChatMessage] = Field(min_length=1, max_length=12)

    @field_validator("messages")
    @classmethod
    def last_is_user(cls, value: list[ChatMessage]) -> list[ChatMessage]:
        if value[-1].role != "user":
            raise ValueError("The last message must come from the customer")
        return value


class ConciergeResponse(BaseModel):
    reply: str
    follow_up_question: str | None = Field(default=None, serialization_alias="followUpQuestion")
    ready: bool
    filters: dict
    unsupported: list[str] = []

    model_config = ConfigDict(populate_by_name=True)
