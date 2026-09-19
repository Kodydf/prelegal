import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlatformApp from "@/components/PlatformApp";
import { bodyOf, json, routeFetch } from "./helpers";
import { sampleDefinition, sampleValues } from "./fixtures";

// The PDF renderer isn't needed here and is heavy in jsdom.
vi.mock("@/components/DownloadButton", () => ({ default: () => <button>Download as PDF</button> }));

afterEach(() => vi.unstubAllGlobals());

const summary = {
  id: 5,
  documentId: sampleDefinition.id,
  documentName: "Service Level Agreement",
  parties: ["Northwind Inc", "Lee Design LLC"],
  updatedAt: "2026-09-19T02:49:09+00:00",
};
const detail = {
  id: 5,
  documentId: sampleDefinition.id,
  values: sampleValues,
  messages: [
    { role: "user", content: "We need an SLA" },
    { role: "assistant", content: "Great, who is the provider?" },
  ],
  updatedAt: summary.updatedAt,
};

const baseRoutes = {
  "GET /api/auth/me": () => json({ email: "ann@example.com" }),
  "GET /api/documents/": () => json(sampleDefinition),
};

describe("PlatformApp", () => {
  it("shows the header with the user, navigation, and the draft disclaimer footer", async () => {
    routeFetch(baseRoutes);
    render(<PlatformApp />);
    expect(await screen.findByText("ann@example.com")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "New document" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: "My documents" })).toBeInTheDocument();
    expect(screen.getByText(/Documents are drafts and are subject to legal review/)).toBeInTheDocument();
  });

  it("opens a saved document from My documents with its conversation and preview restored", async () => {
    routeFetch({
      ...baseRoutes,
      "GET /api/drafts": () => json([summary]),
      "GET /api/drafts/5": () => json(detail),
    });
    render(<PlatformApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "My documents" }));
    await user.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByRole("heading", { name: "Continue your document" })).toBeInTheDocument();
    expect(screen.getByText("Great, who is the provider?")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Service Level Agreement" })).toBeInTheDocument();
    expect(screen.getAllByText("Northwind Inc").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Download as PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My documents" })).not.toHaveAttribute("aria-current");
  });

  it("continues a resumed draft: the next message carries the draft id, values and history", async () => {
    const fetchMock = routeFetch({
      ...baseRoutes,
      "GET /api/drafts": () => json([summary]),
      "GET /api/drafts/5": () => json(detail),
      "POST /api/chat": () =>
        json({ reply: "And the customer?", documentId: sampleDefinition.id, values: sampleValues, draftId: 5 }),
    });
    render(<PlatformApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "My documents" }));
    await user.click(await screen.findByRole("button", { name: "Open" }));
    await screen.findByText("Great, who is the provider?");

    await user.type(screen.getByLabelText("Message"), "Northwind Inc");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("And the customer?");

    const body = bodyOf(fetchMock, "POST", "/api/chat");
    expect(body.draftId).toBe(5);
    expect(body.documentId).toBe(sampleDefinition.id);
    expect(body.values).toEqual(sampleValues);
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual([
      "We need an SLA",
      "Great, who is the provider?",
      "Northwind Inc",
    ]);
  });

  it("New document starts fresh, even after resuming a draft", async () => {
    routeFetch({
      ...baseRoutes,
      "GET /api/drafts": () => json([summary]),
      "GET /api/drafts/5": () => json(detail),
    });
    render(<PlatformApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "My documents" }));
    await user.click(await screen.findByRole("button", { name: "Open" }));
    await screen.findByRole("heading", { name: "Continue your document" });

    await user.click(screen.getByRole("button", { name: "New document" }));
    expect(await screen.findByRole("heading", { name: "Draft a new document" })).toBeInTheDocument();
    expect(screen.queryByText("Great, who is the provider?")).not.toBeInTheDocument();
    expect(screen.getByText(/document will appear here/)).toBeInTheDocument();
  });

  it("stays on the list and shows an error if a saved document can't be opened", async () => {
    routeFetch({
      ...baseRoutes,
      "GET /api/drafts": () => json([summary]),
      "GET /api/drafts/5": () => json({ detail: "Document not found." }, 404),
    });
    render(<PlatformApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "My documents" }));
    await user.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Document not found.");
    expect(screen.getByRole("heading", { name: "My documents" })).toBeInTheDocument();
  });

  it("shows the draft disclaimer next to the download button and in the preview", async () => {
    routeFetch({
      ...baseRoutes,
      "GET /api/drafts": () => json([summary]),
      "GET /api/drafts/5": () => json(detail),
    });
    render(<PlatformApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "My documents" }));
    await user.click(await screen.findByRole("button", { name: "Open" }));
    await screen.findByRole("heading", { name: "Service Level Agreement" });
    expect(screen.getByText(/^DRAFT: This document is a draft/)).toBeInTheDocument();
    expect(screen.getByText(/This is a draft and is subject to legal review before it is signed or relied on/)).toBeInTheDocument();
  });

  it("after Start over on a resumed draft, the heading no longer says Continue", async () => {
    routeFetch({
      ...baseRoutes,
      "GET /api/drafts": () => json([summary]),
      "GET /api/drafts/5": () => json(detail),
    });
    render(<PlatformApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "My documents" }));
    await user.click(await screen.findByRole("button", { name: "Open" }));
    await screen.findByRole("heading", { name: "Continue your document" });

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByRole("heading", { name: "Draft a new document" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Continue your document" })).not.toBeInTheDocument();
  });

  it("moves keyboard focus to the new screen when navigating", async () => {
    routeFetch({ ...baseRoutes, "GET /api/drafts": () => json([summary]) });
    render(<PlatformApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "My documents" }));
    await screen.findByRole("heading", { name: "My documents" });
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("has one page-level heading on the drafting screen (the document title is a sub-heading)", async () => {
    routeFetch({
      ...baseRoutes,
      "GET /api/drafts": () => json([summary]),
      "GET /api/drafts/5": () => json(detail),
    });
    render(<PlatformApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "My documents" }));
    await user.click(await screen.findByRole("button", { name: "Open" }));
    await screen.findByRole("heading", { name: "Service Level Agreement" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
