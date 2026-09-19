import json

import pytest
from fastapi.testclient import TestClient

from app.definitions import DEFINITIONS
from app.documents import content_dir, get_document, list_documents, load_documents
from app.main import create_app
from app.terms import parse_terms

EXPECTED_IDS = {
    "mutual-nda", "cloud-service-agreement", "design-partner-agreement", "service-level-agreement",
    "professional-services-agreement", "data-processing-agreement", "software-license-agreement",
    "partnership-agreement", "business-associate-agreement", "pilot-agreement", "ai-addendum",
}


def test_every_catalog_template_is_supported():
    catalog = json.loads((content_dir() / "catalog.json").read_text("utf-8"))
    supported_files = {d.file for d in DEFINITIONS}
    for entry in catalog:
        if entry["file_name"].endswith("-coverpage.md"):
            continue  # the app generates its own cover page from the field definitions
        assert entry["file_name"] in supported_files, f"{entry['file_name']} has no definition"


def test_all_expected_documents_load():
    assert set(load_documents()) == EXPECTED_IDS
    assert {d.id for d in list_documents()} == EXPECTED_IDS


@pytest.mark.parametrize("document", list(load_documents().values()), ids=lambda d: d.id)
def test_document_definition_is_well_formed(document):
    keys = [f.key for f in document.all_fields()]
    assert len(keys) == len(set(keys)), "field keys must be unique"
    assert all(f.label for f in document.all_fields())
    assert len(document.parties) == 2
    assert all(len(p.fields) == 5 for p in document.parties)
    assert all(len(f.default) <= 500 or f.kind == "long" for f in document.all_fields())


@pytest.mark.parametrize("document", list(load_documents().values()), ids=lambda d: d.id)
def test_terms_parse_cleanly(document):
    terms = document.terms
    assert terms[0].type == "title"
    items = [b for b in terms if b.type == "item"]
    assert len(items) >= 10
    for block in terms:
        assert "<span" not in block.text + block.title and "</" not in block.text + block.title
    assert all(b.text or b.title for b in items)
    assert [b.number for b in items if b.depth == 0][:2] == ["1.", "2."]


def test_parse_terms_numbering_titles_and_cleanup():
    md = (
        "# Test Agreement\n\n"
        '1. <span class="header_2" id="1">Service</span>\n'
        '    1. <span class="header_3" id="1.1">Access.</span>  <span class="coverpage_link">Customer</span> may use it.\n'
        '        a. first thing\n'
        '        b. see [the docs](https://x.test/d) or <https://y.test>\n'
        '    2. **"Term"** means a period.\n'
        '2. **Intro**. Bold lead-in text.\n\n'
        "Closing line.\n"
    )
    blocks = parse_terms(md)
    assert [(b.type, b.depth, b.number, b.title) for b in blocks] == [
        ("title", 0, "", ""),
        ("item", 0, "1.", "Service"),
        ("item", 1, "1.1", "Access."),
        ("item", 2, "(a)", ""),
        ("item", 2, "(b)", ""),
        ("item", 1, "1.2", ""),
        ("item", 0, "2.", "Intro"),
        ("paragraph", 0, "", ""),
    ]
    assert blocks[2].text == "Customer may use it."
    assert blocks[4].text == "see the docs (https://x.test/d) or https://y.test"
    assert blocks[5].text == '**"Term"** means a period.'
    assert blocks[6].text == "Bold lead-in text."


def test_documents_endpoints():
    with TestClient(create_app()) as client:
        listing = client.get("/api/documents")
        assert listing.status_code == 200
        assert {d["id"] for d in listing.json()} == EXPECTED_IDS

        detail = client.get("/api/documents/service-level-agreement").json()
        assert detail["name"] == "Service Level Agreement"
        assert [p["role"] for p in detail["parties"]] == ["Provider", "Customer"]
        assert detail["parties"][0]["fields"][0]["key"] == "provider_company"
        assert detail["fields"][0]["key"] == "subscription_period"
        assert detail["terms"][0]["type"] == "title"

        assert client.get("/api/documents/nope").status_code == 404


def test_nda_defaults_come_from_definition():
    defaults = get_document("mutual-nda").defaults()
    assert defaults["purpose"].startswith("Evaluating whether")
    assert defaults["party1_company"] == ""
