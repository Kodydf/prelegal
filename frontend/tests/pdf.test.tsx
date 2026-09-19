// @vitest-environment node
import { join } from "node:path";
import { pdf } from "@react-pdf/renderer";
import { describe, expect, it, vi } from "vitest";
import DocumentPdf from "@/lib/pdf/DocumentPdf";
import type { DocumentDefinition } from "@/types/document";
import { sampleDefinition, sampleValues } from "./fixtures";

// The PDF fonts are registered with site-relative URLs ("/fonts/..."); in Node react-pdf would read
// them as filesystem paths, so point them at public/ instead.
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  const register = actual.Font.register.bind(actual.Font);
  actual.Font.register = (options) =>
    register({
      ...options,
      fonts: (options as { fonts: { src: string }[] }).fonts.map((f) => ({
        ...f,
        src: join(process.cwd(), "public", f.src),
      })),
    } as never);
  return actual;
});

async function render(definition: DocumentDefinition): Promise<Buffer> {
  const stream = await pdf(<DocumentPdf definition={definition} values={sampleValues} />).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe("DocumentPdf", () => {
  it("generates a valid PDF for a small document", async () => {
    const bytes = await render(sampleDefinition);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  }, 30000);

  it("paginates a long document with hundreds of clauses", async () => {
    const terms = Array.from({ length: 300 }, (_, i) => ({
      type: "item" as const,
      depth: i % 3,
      number: `${i}.`,
      title: i % 3 === 0 ? `Section ${i}` : "",
      text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6),
    }));
    const bytes = await render({ ...sampleDefinition, terms });
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = bytes.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(10);
  }, 60000);
});
