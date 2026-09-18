"""Mutual NDA field models. The wire format is camelCase to match the frontend's NdaFormData."""

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PartyDetails(CamelModel):
    print_name: str = ""
    title: str = ""
    company: str = ""
    notice_address: str = ""
    date: str = ""


class NdaFields(CamelModel):
    purpose: str = "Evaluating whether to enter into a business relationship with the other party."
    effective_date: str = ""
    mnda_term_type: Literal["expires", "continues"] = "expires"
    mnda_term_years: int = 1
    confidentiality_term_type: Literal["years", "perpetuity"] = "years"
    confidentiality_term_years: int = 1
    governing_law: str = ""
    jurisdiction: str = ""
    modifications: str = ""
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
    """Return a copy of `fields` with every non-null value in `patch` applied."""
    updates = {}
    for name in NdaPatch.model_fields:
        value = getattr(patch, name)
        if value is None:
            continue
        if isinstance(value, PartyPatch):
            current = getattr(fields, name)
            updates[name] = current.model_copy(update=value.model_dump(exclude_none=True))
        else:
            updates[name] = value
    return fields.model_copy(update=updates)
