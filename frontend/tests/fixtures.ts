import type { DocumentDefinition, DocumentValues } from "@/types/document";

const partyFields = (key: string, role: string) =>
  [
    ["company", "Company"],
    ["name", "Print Name"],
    ["title", "Title"],
    ["address", "Notice Address"],
    ["date", "Date"],
  ].map(([suffix, label]) => ({
    key: `${key}_${suffix}`,
    label: `${role} ${label}`,
    hint: "",
    kind: "text" as const,
    default: "",
  }));

/** A small document shaped like the backend's DocumentDetail. */
export const sampleDefinition: DocumentDefinition = {
  id: "service-level-agreement",
  name: "Service Level Agreement",
  description: "An SLA.",
  note: "Designed to be used alongside a Cloud Service Agreement.",
  parties: [
    { key: "provider", role: "Provider", hint: "", fields: partyFields("provider", "Provider") },
    { key: "customer", role: "Customer", hint: "", fields: partyFields("customer", "Customer") },
  ],
  fields: [
    { key: "target_uptime", label: "Target Uptime", hint: "e.g. 99.9%", kind: "text", default: "" },
    { key: "uptime_credit", label: "Uptime Credit", hint: "", kind: "long", default: "5% of fees" },
  ],
  terms: [
    { type: "title", text: "Service Level Agreement", depth: 0, number: "", title: "" },
    { type: "item", text: "", depth: 0, number: "1.", title: "Uptime" },
    {
      type: "item",
      text: "Provider will meet the Target Uptime.",
      depth: 1,
      number: "1.1",
      title: "Target Uptime.",
    },
    { type: "item", text: 'a **"Credit"** applies', depth: 2, number: "(a)", title: "" },
    { type: "paragraph", text: "Closing paragraph.", depth: 0, number: "", title: "" },
  ],
};

export const sampleValues: DocumentValues = {
  target_uptime: "99.9%",
  uptime_credit: "5% of fees",
  provider_company: "Northwind Inc",
  provider_name: "Dana Cruz",
  provider_title: "",
  provider_address: "",
  provider_date: "",
  customer_company: "Lee Design LLC",
  customer_name: "",
  customer_title: "",
  customer_address: "",
  customer_date: "",
};
