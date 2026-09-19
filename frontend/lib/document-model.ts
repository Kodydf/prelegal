import type { DocumentDefinition, DocumentValues } from "@/types/document";

/**
 * A small declarative document model shared by the on-screen preview (HTML) and the PDF export
 * (@react-pdf/renderer), so the two outputs stay in sync. A document is a generated Cover Page
 * (key terms + signature block) followed by the standard terms exactly as written in the template.
 */
export type DocumentBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "notice"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "field"; label: string; hint?: string; value: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "term"; depth: number; number: string; title: string; text: string }
  | { type: "footer"; text: string };

const NOT_SPECIFIED = "[Not specified]";

/** Shown on every generated document, on screen and in the PDF. */
export const DRAFT_NOTICE =
  "DRAFT: This document is a draft and is subject to legal review before it is signed or relied on.";

function orPlaceholder(value: string | undefined, placeholder: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : placeholder;
}

export function buildDocumentBlocks(def: DocumentDefinition, values: DocumentValues): DocumentBlock[] {
  const blocks: DocumentBlock[] = [
    { type: "title", text: def.name },
    { type: "subtitle", text: "Cover Page" },
    { type: "notice", text: DRAFT_NOTICE },
    {
      type: "paragraph",
      text: "This Cover Page and the Standard Terms that follow together form the agreement. The key terms below apply to the Standard Terms.",
    },
  ];
  if (def.note) blocks.push({ type: "paragraph", text: def.note });

  blocks.push({ type: "heading", text: "Key Terms" });
  for (const field of def.fields) {
    blocks.push({
      type: "field",
      label: field.label,
      hint: field.hint || undefined,
      value: orPlaceholder(values[field.key], NOT_SPECIFIED),
    });
  }

  blocks.push({ type: "heading", text: "Parties" });
  const signatureRows = def.parties[0]?.fields ?? [];
  blocks.push({
    type: "table",
    headers: ["", ...def.parties.map((p) => p.role.toUpperCase())],
    rows: [
      ["Signature", ...def.parties.map(() => "")],
      ...signatureRows.map((field, i) => [
        field.short_label,
        ...def.parties.map((p) => orPlaceholder(values[p.fields[i].key], "—")),
      ]),
    ],
  });

  blocks.push({ type: "heading", text: "Standard Terms" });
  for (const term of def.terms) {
    if (term.type === "title") continue; // the document title is already at the top
    if (term.type === "paragraph") blocks.push({ type: "paragraph", text: term.text });
    else
      blocks.push({ type: "term", depth: term.depth, number: term.number, title: term.title, text: term.text });
  }

  blocks.push({
    type: "footer",
    text: `Common Paper ${def.name}, free to use under CC BY 4.0 (creativecommons.org/licenses/by/4.0).`,
  });
  return blocks;
}

/** Split text on **bold** markers, as left in the template terms. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}
