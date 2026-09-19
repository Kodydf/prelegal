import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyDocuments, { formatUpdated } from "@/components/MyDocuments";
import type { DraftSummary } from "@/lib/drafts";
import { json, noContent, routeFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const drafts: DraftSummary[] = [
  {
    id: 2,
    documentId: "pilot-agreement",
    documentName: "Pilot Agreement",
    parties: ["Northwind Inc", "Lee Design LLC"],
    updatedAt: "2026-09-19T02:49:09+00:00",
  },
  { id: 1, documentId: "mutual-nda", documentName: "Mutual Non-Disclosure Agreement", parties: [], updatedAt: "2026-09-18T10:00:00+00:00" },
];

describe("MyDocuments", () => {
  it("lists saved documents with their parties, in the order the server returns them", async () => {
    routeFetch({ "GET /api/drafts": () => json(drafts) });
    render(<MyDocuments onOpen={() => {}} onNew={() => {}} />);

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Pilot Agreement")).toBeInTheDocument();
    expect(within(items[0]).getByText("Northwind Inc & Lee Design LLC")).toBeInTheDocument();
    expect(within(items[1]).getByText("Parties not filled in yet")).toBeInTheDocument();
    expect(within(items[0]).getByText(/^Updated /)).toBeInTheDocument();
  });

  it("opens the chosen document", async () => {
    routeFetch({ "GET /api/drafts": () => json(drafts) });
    const onOpen = vi.fn();
    render(<MyDocuments onOpen={onOpen} onNew={() => {}} />);
    const user = userEvent.setup();
    const items = await screen.findAllByRole("listitem");
    await user.click(within(items[1]).getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("shows a friendly empty state with a way to start", async () => {
    routeFetch({ "GET /api/drafts": () => json([]) });
    const onNew = vi.fn();
    render(<MyDocuments onOpen={() => {}} onNew={onNew} />);
    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Draft your first document" }));
    expect(onNew).toHaveBeenCalled();
  });

  it("asks for confirmation before deleting, and cancel keeps the document", async () => {
    const fetchMock = routeFetch({ "GET /api/drafts": () => json(drafts) });
    render(<MyDocuments onOpen={() => {}} onNew={() => {}} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Delete Pilot Agreement" }));
    expect(screen.getByText("Delete this document?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Delete this document?")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("deletes a confirmed document and removes it from the list", async () => {
    const fetchMock = routeFetch({
      "GET /api/drafts": () => json(drafts),
      "DELETE /api/drafts/2": () => noContent(),
    });
    render(<MyDocuments onOpen={() => {}} onNew={() => {}} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Delete Pilot Agreement" }));
    await user.click(screen.getByRole("button", { name: /Confirm delete/ }));

    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Pilot Agreement")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/drafts/2", { method: "DELETE" });
  });

  it("keeps the document and shows an error if the delete fails", async () => {
    routeFetch({
      "GET /api/drafts": () => json(drafts),
      "DELETE /api/drafts/2": () => json({ detail: "Document not found." }, 404),
    });
    render(<MyDocuments onOpen={() => {}} onNew={() => {}} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Delete Pilot Agreement" }));
    await user.click(screen.getByRole("button", { name: /Confirm delete/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Document not found.");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows an error with retry if the list can't be loaded", async () => {
    let attempts = 0;
    routeFetch({ "GET /api/drafts": () => (++attempts === 1 ? json({ detail: "Server error." }, 500) : json(drafts)) });
    render(<MyDocuments onOpen={() => {}} onNew={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Server error.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("formatUpdated", () => {
  it("formats an ISO timestamp for display and leaves an unparseable one alone", () => {
    expect(formatUpdated("2026-09-19T02:49:09+00:00")).toMatch(/2026/);
    expect(formatUpdated("not a date")).toBe("not a date");
  });
});

describe("keyboard focus in the delete flow", () => {
    const setup = async () => {
      routeFetch({
        "GET /api/drafts": () => json(drafts),
        "DELETE /api/drafts/2": () => noContent(),
      });
      render(<MyDocuments onOpen={() => {}} onNew={() => {}} />);
      return userEvent.setup();
    };

    it("moves focus to the confirm button, and back to Delete when cancelled", async () => {
      const user = await setup();
      const deleteButton = await screen.findByRole("button", { name: "Delete Pilot Agreement" });
      await user.click(deleteButton);
      expect(screen.getByRole("button", { name: "Confirm delete Pilot Agreement" })).toHaveFocus();

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("button", { name: "Delete Pilot Agreement" })).toHaveFocus();
    });

    it("Escape cancels the confirmation and returns focus to Delete", async () => {
      const user = await setup();
      await user.click(await screen.findByRole("button", { name: "Delete Pilot Agreement" }));
      await user.keyboard("{Escape}");
      expect(screen.queryByText("Delete this document?")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete Pilot Agreement" })).toHaveFocus();
    });

    it("after a confirmed delete, focus goes to the page heading rather than being lost", async () => {
      const user = await setup();
      await user.click(await screen.findByRole("button", { name: "Delete Pilot Agreement" }));
      await user.click(screen.getByRole("button", { name: /Confirm delete/ }));
      await screen.findAllByRole("listitem");
      expect(screen.getByRole("heading", { name: "My documents" })).toHaveFocus();
    });

    it("announces the confirmation question through a live region", async () => {
      const user = await setup();
      const deleteButton = await screen.findByRole("button", { name: "Delete Pilot Agreement" });
      const region = deleteButton.parentElement!;
      expect(region).toHaveAttribute("aria-live", "polite");
      await user.click(deleteButton);
      expect(region).toHaveTextContent("Delete this document?");
    });
});
