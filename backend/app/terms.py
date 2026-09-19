"""Parse a Common Paper standard-terms Markdown template into a flat list of display blocks.

The templates are regular: a `# Title`, then numbered items nested by 4-space indents
(sections -> clauses -> lettered sub-items), with `<span>` tags marking headings and defined
terms. Spans are stripped; `**bold**` is kept for the renderers.
"""

import re
from typing import Literal

from pydantic import BaseModel

_ITEM = re.compile(r"^(?P<indent> *)(?P<marker>\d+|[a-z]{1,4})\.\s+(?P<body>.*)$")
_HEADER_SPAN = re.compile(r'^<span class="header_\d"[^>]*>(?P<title>.*?)</span>\s*(?P<rest>.*)$')
_BOLD_TITLE = re.compile(r"^\*\*(?P<title>[^*]+?)\*\*\.\s+(?P<rest>.*)$")
_SPAN = re.compile(r"</?span[^>]*>")
_LINK = re.compile(r"\[([^\]]*)\]\(([^)]*)\)")
_AUTOLINK = re.compile(r"<(https?://[^>]+)>")
_LABEL = re.compile(r"</?label[^>]*>")


class TermsBlock(BaseModel):
    type: Literal["title", "item", "paragraph"]
    text: str
    depth: int = 0
    number: str = ""  # display number, e.g. "1.", "1.2", "(a)"
    title: str = ""  # bold lead-in heading, if the source has one


def _clean(text: str) -> str:
    text = _SPAN.sub("", text)
    text = _LABEL.sub("", text)
    text = _LINK.sub(lambda m: m.group(1) if m.group(1) == m.group(2) else f"{m.group(1)} ({m.group(2)})", text)
    text = _AUTOLINK.sub(r"\1", text)
    return text.strip()


def parse_terms(markdown: str) -> list[TermsBlock]:
    blocks: list[TermsBlock] = []
    counters: list[int] = []  # running item count per depth, for hierarchical numbers

    for line in markdown.splitlines():
        if not line.strip():
            continue
        if line.startswith("# "):
            blocks.append(TermsBlock(type="title", text=_clean(line[2:])))
            continue

        match = _ITEM.match(line)
        if not match:
            counters.clear()
            blocks.append(TermsBlock(type="paragraph", text=_clean(line)))
            continue

        depth = len(match["indent"]) // 4
        del counters[depth + 1 :]
        while len(counters) <= depth:
            counters.append(0)
        counters[depth] += 1

        body = match["body"].strip()
        title = ""
        header = _HEADER_SPAN.match(body)
        bold = _BOLD_TITLE.match(body) if depth == 0 else None
        if header:
            title, body = header["title"], header["rest"]
        elif bold:
            title, body = bold["title"], bold["rest"]

        if depth == 0:
            number = f"{counters[0]}."
        elif depth == 1:
            number = f"{counters[0]}.{counters[1]}"
        else:
            number = f"({match['marker']})"
        blocks.append(
            TermsBlock(type="item", depth=depth, number=number, title=_clean(title), text=_clean(body))
        )
    return blocks
