"""Mutual NDA field models. The wire format is camelCase to match the frontend's NdaFormData."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# Length limits bound the prompt size and keep LLM-supplied values sane.
ShortText = Annotated[str, Field(max_length=500)]
LongText = Annotated[str, Field(max_length=2000)]
Years = Annotated[int, Field(ge=1, le=99)]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PartyDetails(CamelModel):
    print_name: ShortText = ""
    title: ShortText = ""
    company: ShortText = ""
    notice_address: ShortText = ""
    date: ShortText = ""


class NdaFields(CamelModel):
    purpose: LongText = "Evaluating whether to enter into a business relationship with the other party."
    effective_date: ShortText = ""
    mnda_term_type: Literal["expires", "continues"] = "expires"
    mnda_term_years: Years = 1
    confidentiality_term_type: Literal["years", "perpetuity"] = "years"
    confidentiality_term_years: Years = 1
    governing_law: ShortText = ""
    jurisdiction: ShortText = ""
    modifications: LongText = ""
    party_one: PartyDetails = PartyDetails()
    party_two: PartyDetails = PartyDetails()


# --- Patch models: what the LLM returns. Every field is required but nullable, which keeps
# --- the JSON schema strict-mode friendly. `None` means "not learned this turn, leave as is".


class PartyPatch(CamelModel):
    print_name: str | None
    title: str | None
    company: str | None
    notice_address: str | None
    date: str | None


class NdaPatch(CamelModel):
    purpose: str | None
    effective_date: str | None
    mnda_term_type: Literal["expires", "continues"] | None
    mnda_term_years: int | None
    confidentiality_term_type: Literal["years", "perpetuity"] | None
    confidentiality_term_years: int | None
    governing_law: str | None
    jurisdiction: str | None
    modifications: str | None
    party_one: PartyPatch | None
    party_two: PartyPatch | None


def apply_patch(fields: NdaFields, patch: NdaPatch) -> NdaFields:
    """Return `fields` with every non-null value in `patch` applied, re-validated against the limits."""
    updates = {}
    for name in NdaPatch.model_fields:
        value = getattr(patch, name)
        if value is None:
            continue
        if isinstance(value, PartyPatch):
            current = getattr(fields, name)
            updates[name] = {**current.model_dump(), **value.model_dump(exclude_none=True)}
        else:
            updates[name] = value
    return NdaFields.model_validate({**fields.model_dump(), **updates})
