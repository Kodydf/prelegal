"""Registry of supported documents: catalog descriptions + field definitions + parsed terms."""

import json
import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

from app.definitions import DEFINITIONS, FieldDef, PartyDef
from app.terms import TermsBlock, parse_terms

# Repo root in development; the Docker image sets PRELEGAL_CONTENT_DIR to where it copies the content.
DEFAULT_CONTENT_DIR = Path(__file__).resolve().parents[2]

TEXT_MAX_LENGTH = 500
LONG_MAX_LENGTH = 2000

# Signature-block fields every party has; keys become `<party>_<suffix>`.
PARTY_FIELDS = [
    ("company", "Company", "Legal name of the company"),
    ("name", "Print Name", "Full name of the person signing"),
    ("title", "Title", "Job title of the person signing"),
    ("address", "Notice Address", "Email or postal address for legal notices"),
    ("date", "Date", "Date of signing"),
]


class DocumentSummary(BaseModel):
    id: str
    name: str
    description: str


class PartyFieldDef(FieldDef):
    short_label: str  # the label without the party's role, e.g. "Print Name" (for signature-block rows)


class PartyDetail(BaseModel):
    key: str
    role: str
    hint: str
    fields: list[PartyFieldDef]


class DocumentDetail(DocumentSummary):
    note: str
    parties: list[PartyDetail]
    fields: list[FieldDef]  # key terms, in the order the assistant should ask about them
    terms: list[TermsBlock]

    def all_fields(self) -> list[FieldDef]:
        return self.fields + [f for p in self.parties for f in p.fields]

    def field_map(self) -> dict[str, FieldDef]:
        return {f.key: f for f in self.all_fields()}

    def defaults(self) -> dict[str, str]:
        return {f.key: f.default for f in self.all_fields()}


def max_length(field: FieldDef) -> int:
    return LONG_MAX_LENGTH if field.kind == "long" else TEXT_MAX_LENGTH


def _party_detail(party: PartyDef) -> PartyDetail:
    fields = [
        PartyFieldDef(key=f"{party.key}_{suffix}", label=f"{party.role} {label}", short_label=label, hint=hint)
        for suffix, label, hint in PARTY_FIELDS
    ]
    return PartyDetail(key=party.key, role=party.role, hint=party.hint, fields=fields)


def content_dir() -> Path:
    return Path(os.environ.get("PRELEGAL_CONTENT_DIR", DEFAULT_CONTENT_DIR))


@lru_cache
def load_documents() -> dict[str, DocumentDetail]:
    """Build every supported document once; fails fast if a template or catalog entry is missing."""
    root = content_dir()
    catalog = {entry["file_name"]: entry for entry in json.loads((root / "catalog.json").read_text("utf-8"))}
    documents: dict[str, DocumentDetail] = {}
    for spec in DEFINITIONS:
        entry = catalog[spec.file]
        documents[spec.id] = DocumentDetail(
            id=spec.id,
            name=spec.name,
            description=spec.description or entry["description"],
            note=spec.note,
            parties=[_party_detail(p) for p in spec.parties],
            fields=spec.fields,
            terms=parse_terms((root / "templates" / spec.file).read_text("utf-8")),
        )
    return documents


def list_documents() -> list[DocumentSummary]:
    return [DocumentSummary(id=d.id, name=d.name, description=d.description) for d in load_documents().values()]


def get_document(document_id: str) -> DocumentDetail | None:
    return load_documents().get(document_id)
