import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DownloadButton from "@/components/DownloadButton";
import { sampleDefinition, sampleValues } from "./fixtures";

const toBlob = vi.fn();
vi.mock("@react-pdf/renderer", () => ({
  pdf: () => ({ toBlob }),
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (styles: unknown) => styles },
  Font: { register: () => {} },
}));

describe("DownloadButton", () => {
  it("shows an accessible error, in the app's alert style, if the PDF cannot be generated", async () => {
    toBlob.mockRejectedValueOnce(new Error("layout failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<DownloadButton definition={sampleDefinition} values={sampleValues} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Download as PDF" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong generating the PDF");
    expect(alert.className).not.toMatch(/red/);
    expect(screen.getByRole("button", { name: "Download as PDF" })).toBeEnabled(); // can try again
  });

  it("downloads a file named after the document and the parties", async () => {
    toBlob.mockResolvedValueOnce(new Blob(["%PDF-"]));
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    render(<DownloadButton definition={sampleDefinition} values={sampleValues} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Download as PDF" }));
    await vi.waitFor(() => expect(clicked).toEqual(["Service-Level-Agreement-Northwind-Inc-and-Lee-Design-LLC.pdf"]));
  });
});
