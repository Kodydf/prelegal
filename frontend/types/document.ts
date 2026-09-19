// Mirrors the backend's DocumentDetail (GET /api/documents/{id}).
export interface FieldDef {
  key: string;
  label: string;
  hint: string;
  kind: "text" | "long";
  default: string;
}

export interface PartyFieldDef extends FieldDef {
  /** The label without the party's role, e.g. "Print Name". */
  short_label: string;
}

export interface PartyDetail {
  key: string;
  role: string;
  hint: string;
  /** Signature-block fields; labels are "<role> <label>", e.g. "Provider Print Name". */
  fields: PartyFieldDef[];
}

export interface TermsBlock {
  type: "title" | "item" | "paragraph";
  text: string;
  depth: number;
  number: string;
  title: string;
}

export interface DocumentDefinition {
  id: string;
  name: string;
  description: string;
  note: string;
  parties: PartyDetail[];
  fields: FieldDef[];
  terms: TermsBlock[];
}

/** Field values keyed by FieldDef.key. */
export type DocumentValues = Record<string, string>;
