import { describe, expect, it } from "vitest";
import { buildDocumentBlocks, splitBold } from "@/lib/document-model";
import { sampleDefinition, sampleValues } from "./fixtures";

describe("buildDocumentBlocks", () => {
  const blocks = buildDocumentBlocks(sampleDefinition, sampleValues);

  it("starts with the title, cover page subtitle and the document note", () => {
    expect(blocks.slice(0, 2)).toEqual([
      { type: "title", text: "Service Level Agreement" },
      { type: "subtitle", text: "Cover Page" },
    ]);
    expect(blocks).toContainEqual({
      type: "paragraph",
      text: "Designed to be used alongside a Cloud Service Agreement.",
    });
  });

  it("lists each key term with its value, hint and a placeholder when empty", () => {
    const fields = blocks.filter((b) => b.type === "field");
    expect(fields).toEqual([
      { type: "field", label: "Target Uptime", hint: "e.g. 99.9%", value: "99.9%" },
      { type: "field", label: "Uptime Credit", hint: undefined, value: "5% of fees" },
    ]);

    const empty = buildDocumentBlocks(sampleDefinition, {}).filter((b) => b.type === "field");
    expect(empty.map((f) => f.type === "field" && f.value)).toEqual(["[Not specified]", "[Not specified]"]);
  });

  it("builds a signature table with one column per party and role-free row labels", () => {
    const table = blocks.find((b) => b.type === "table");
    expect(table).toEqual({
      type: "table",
      headers: ["", "PROVIDER", "CUSTOMER"],
      rows: [
        ["Signature", "", ""],
        ["Company", "Northwind Inc", "Lee Design LLC"],
        ["Print Name", "Dana Cruz", "—"],
        ["Title", "—", "—"],
        ["Notice Address", "—", "—"],
        ["Date", "—", "—"],
      ],
    });
  });

  it("appends the standard terms after their own heading, without repeating the title", () => {
    const idx = blocks.findIndex((b) => b.type === "heading" && b.text === "Standard Terms");
    expect(idx).toBeGreaterThan(0);
    expect(blocks.slice(idx + 1, idx + 5)).toEqual([
      { type: "term", depth: 0, number: "1.", title: "Uptime", text: "" },
      { type: "term", depth: 1, number: "1.1", title: "Target Uptime.", text: "Provider will meet the Target Uptime." },
      { type: "term", depth: 2, number: "(a)", title: "", text: 'a **"Credit"** applies' },
      { type: "paragraph", text: "Closing paragraph." },
    ]);
    expect(blocks.filter((b) => b.type === "title")).toHaveLength(1);
  });

  it("ends with the license footer", () => {
    expect(blocks.at(-1)).toEqual({
      type: "footer",
      text: "Common Paper Service Level Agreement, free to use under CC BY 4.0 (creativecommons.org/licenses/by/4.0).",
    });
  });
});

describe("splitBold", () => {
  it("splits on ** markers", () => {
    expect(splitBold('a **"Term"** means b')).toEqual([
      { text: "a ", bold: false },
      { text: '"Term"', bold: true },
      { text: " means b", bold: false },
    ]);
    expect(splitBold("plain")).toEqual([{ text: "plain", bold: false }]);
    expect(splitBold("")).toEqual([]);
  });
});
