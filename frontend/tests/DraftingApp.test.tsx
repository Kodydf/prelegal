import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DraftingApp from "@/components/DraftingApp";
import { sampleDefinition, sampleValues } from "./fixtures";

// The PDF renderer isn't needed here and is heavy in jsdom.
vi.mock("@/components/DownloadButton", () => ({ default: () => <button>Download as PDF</button> }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Handler = () => Response | Promise<Response>;

function routeFetch(handlers: { chat?: Handler; document?: Handler }) {
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

  it("ignores a chat reply that arrives after Start over", async () => {
    let finishChat!: (r: Response) => void;
    const fetchMock = routeFetch({
      chat: () => new Promise<Response>((resolve) => (finishChat = resolve)),
      document: () => json(sampleDefinition),
    });
    render(<DraftingApp />);
    const user = await sendMessage("SLA please");
    await user.click(screen.getByRole("button", { name: "Start over" }));

    finishChat(chatPicksSla());
    await new Promise((resolve) => setTimeout(resolve, 20)); // let the stale reply settle

    expect(screen.getByText(/document will appear here/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Service Level Agreement" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/documents/"), undefined);
  });

  it("does not show a load error from one document against the next document", async () => {
    let finishSecondLoad!: (r: Response) => void;
    let loads = 0;
    let chats = 0;
    routeFetch({
      chat: () =>
        chats++ === 0
          ? json({ reply: "First.", documentId: "first-doc", values: {} })
          : json({ reply: "Second.", documentId: sampleDefinition.id, values: sampleValues }),
      document: () =>
        loads++ === 0
          ? json({ detail: "Unknown document." }, 404)
          : new Promise<Response>((resolve) => (finishSecondLoad = resolve)),
    });
    render(<DraftingApp />);
    const user = await sendMessage("one");
    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown document.");

    await user.type(screen.getByLabelText("Message"), "two");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Loading document…")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    finishSecondLoad(json(sampleDefinition));
    expect(await screen.findByRole("heading", { name: "Service Level Agreement" })).toBeInTheDocument();
  });

  it("remembers the saved draft's id and sends it with the next message", async () => {
    const bodies: { draftId: number | null }[] = [];
    let chats = 0;
    routeFetch({
      chat: () => json({ reply: `Reply ${++chats}`, documentId: sampleDefinition.id, values: sampleValues, draftId: 9 }),
      document: () => json(sampleDefinition),
    });
    const fetchMock = vi.mocked(fetch);
    render(<DraftingApp />);
    const user = await sendMessage("first");
    await screen.findByText("Reply 1");
    await user.type(screen.getByLabelText("Message"), "second");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Reply 2");

    for (const [url, init] of fetchMock.mock.calls) {
      if (String(url) === "/api/chat") bodies.push(JSON.parse(String(init?.body)));
    }
    expect(bodies.map((b) => b.draftId)).toEqual([null, 9]);
  });

  it("Start over forgets the draft id, so the next conversation is saved as a new document", async () => {
    const bodies: { draftId: number | null }[] = [];
    routeFetch({
      chat: () => json({ reply: "ok", documentId: sampleDefinition.id, values: sampleValues, draftId: 9 }),
      document: () => json(sampleDefinition),
    });
    const fetchMock = vi.mocked(fetch);
    render(<DraftingApp />);
    const user = await sendMessage("first");
    await screen.findByRole("heading", { name: "Service Level Agreement" });
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.type(screen.getByLabelText("Message"), "again");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("heading", { name: "Service Level Agreement" });

    for (const [url, init] of fetchMock.mock.calls) {
      if (String(url) === "/api/chat") bodies.push(JSON.parse(String(init?.body)));
    }
    expect(bodies.map((b) => b.draftId)).toEqual([null, null]);
  });
});
