import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "@/components/ChatPanel";

const values = { governing_law: "" };

function mockFetch(...responses: Array<Response | Error>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ok = (
  reply: string,
  documentId: string | null = "mutual-nda",
  v = { governing_law: "Delaware" },
  draftId: number | null = 7,
) => new Response(JSON.stringify({ reply, documentId, values: v, draftId }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("ChatPanel", () => {
  it("starts with a static greeting and makes no request", () => {
    const fetchMock = mockFetch();
    render(<ChatPanel documentId={null} values={{}} draftId={null} onChange={() => {}} />);
    expect(screen.getByText(/help you draft a legal agreement/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the message and draft, shows the reply and reports the new document and values", async () => {
    const fetchMock = mockFetch(ok("Which city for disputes?"));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel documentId="mutual-nda" values={values} draftId={7} onChange={onChange} />);

    await user.type(screen.getByLabelText("Message"), "Delaware law please");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Which city for disputes?")).toBeInTheDocument();
    expect(screen.getByText("Delaware law please")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith("mutual-nda", { governing_law: "Delaware" }, 7);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: "user", content: "Delaware law please" }]); // no greeting
    expect(body.documentId).toBe("mutual-nda");
    expect(body.draftId).toBe(7);
    expect(body.values).toEqual(values);
  });

  it("sends a null document id before one is chosen and passes a null back when none was chosen", async () => {
    const fetchMock = mockFetch(ok("We can't do leases; closest is the Pilot Agreement.", null, {} as never, null));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel documentId={null} values={{}} draftId={null} onChange={onChange} />);
    await user.type(screen.getByLabelText("Message"), "I need a lease");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(/closest is the Pilot Agreement/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).documentId).toBeNull();
    expect(onChange).toHaveBeenCalledWith(null, {}, null);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).draftId).toBeNull();
  });

  it("ignores empty messages", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup();
    render(<ChatPanel documentId={null} values={{}} draftId={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.type(screen.getByLabelText("Message"), "   ");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's error and retries without duplicating the user message", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ detail: "The AI assistant is unavailable right now." }), { status: 502 }),
      ok("Got it!"),
    );
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel documentId={null} values={{}} draftId={null} onChange={onChange} />);

    await user.type(screen.getByLabelText("Message"), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable right now");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Got it!")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByText("hello")).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages).toHaveLength(1);
  });

  it("shows a friendly error when the network fails", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<ChatPanel documentId={null} values={{}} draftId={null} onChange={() => {}} />);
    await user.type(screen.getByLabelText("Message"), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });

  it("offers starter prompts that send a message, and hides them once the conversation starts", async () => {
    const fetchMock = mockFetch(ok("Sure, an NDA.", null, {} as never, null));
    const user = userEvent.setup();
    render(<ChatPanel documentId={null} values={{}} draftId={null} onChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: "I need an NDA" }));
    expect(await screen.findByText("Sure, an NDA.")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual([{ role: "user", content: "I need an NDA" }]);
    expect(screen.queryByRole("button", { name: "I need an NDA" })).not.toBeInTheDocument();
  });

  it("restores a saved conversation and continues it without starter prompts", async () => {
    const fetchMock = mockFetch(ok("Next question?"));
    const user = userEvent.setup();
    const saved = [
      { role: "user" as const, content: "pilot with Lee" },
      { role: "assistant" as const, content: "Great, who is the provider?" },
    ];
    render(<ChatPanel documentId="pilot-agreement" values={values} draftId={7} initialMessages={saved} onChange={() => {}} />);

    expect(screen.getByText(/help you draft a legal agreement/)).toBeInTheDocument();
    expect(screen.getByText("Great, who is the provider?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I need an NDA" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Message"), "Northwind");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Next question?");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual([...saved, { role: "user", content: "Northwind" }]);
  });

  it("sends at most the latest 100 messages, so a long conversation stays within what the server accepts", async () => {
    const fetchMock = mockFetch(ok("Still here."));
    const saved = Array.from({ length: 150 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `saved ${i}`,
    }));
    const user = userEvent.setup();
    render(<ChatPanel documentId="mutual-nda" values={values} draftId={7} initialMessages={saved} onChange={() => {}} />);
    await user.type(screen.getByLabelText("Message"), "latest");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Still here.");

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    expect(sent).toHaveLength(100);
    expect(sent.at(-1)).toEqual({ role: "user", content: "latest" });
    expect(sent[0].content).toBe("saved 51"); // the oldest ones were dropped
  });
});
