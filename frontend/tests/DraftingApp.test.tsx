import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DraftingApp from "@/components/DraftingApp";
import { sampleDefinition, sampleValues } from "./fixtures";

// The PDF renderer isn't needed here and is heavy in jsdom.
vi.mock("@/components/DownloadButton", () => ({ default: () => <button>Download as PDF</button> }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function routeFetch(handlers: { chat?: () => Response; document?: () => Response }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith("/api/chat")) return handlers.chat!();
    if (url.startsWith("/api/documents/")) return handlers.document!();
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const chatPicksSla = () =>
  json({ reply: "Let's draft an SLA. Who is the provider?", documentId: sampleDefinition.id, values: sampleValues });

async function sendMessage(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Message"), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
  return user;
}

afterEach(() => vi.unstubAllGlobals());

describe("DraftingApp", () => {
  it("shows an empty state and no download button before a document is chosen", () => {
    render(<DraftingApp />);
    expect(screen.getByText(/document will appear here/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download as PDF" })).not.toBeInTheDocument();
  });

  it("loads the chosen document and fills the preview with the AI's values", async () => {
    const fetchMock = routeFetch({ chat: chatPicksSla, document: () => json(sampleDefinition) });
    render(<DraftingApp />);
    await sendMessage("We need an SLA for Northwind");

    expect(await screen.findByRole("heading", { name: "Service Level Agreement" })).toBeInTheDocument();
    expect(screen.getAllByText("Northwind Inc").length).toBeGreaterThan(0);
    expect(screen.getByText("Provider will meet the Target Uptime.")).toBeInTheDocument(); // verbatim terms
    expect(screen.getByRole("button", { name: "Download as PDF" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/documents/service-level-agreement", undefined);
    expect(screen.queryByText(/document will appear here/)).not.toBeInTheDocument();
  });

  it("does not show a document when the AI declines and offers something else", async () => {
    routeFetch({ chat: () => json({ reply: "We can't do leases.", documentId: null, values: {} }) });
    render(<DraftingApp />);
    await sendMessage("I need a lease");
    expect(await screen.findByText("We can't do leases.")).toBeInTheDocument();
    expect(screen.getByText(/document will appear here/)).toBeInTheDocument();
  });

  it("Start over clears the document and the conversation", async () => {
    routeFetch({ chat: chatPicksSla, document: () => json(sampleDefinition) });
    render(<DraftingApp />);
    const user = await sendMessage("SLA please");
    await screen.findByRole("heading", { name: "Service Level Agreement" });

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.getByText(/document will appear here/)).toBeInTheDocument();
    expect(screen.queryByText("SLA please")).not.toBeInTheDocument();
    expect(screen.getByText(/help you draft a legal agreement/)).toBeInTheDocument();
  });

  it("shows an error with retry if the document definition fails to load", async () => {
    let attempts = 0;
    routeFetch({
      chat: chatPicksSla,
      document: () => (++attempts === 1 ? json({ detail: "Unknown document." }, 404) : json(sampleDefinition)),
    });
    render(<DraftingApp />);
    const user = await sendMessage("SLA please");

    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown document.");
    await user.click(screen.getAllByRole("button", { name: "Retry" })[0]);
    expect(await screen.findByRole("heading", { name: "Service Level Agreement" })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});
