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

const ok = (reply: string, documentId: string | null = "mutual-nda", v = { governing_law: "Delaware" }) =>
  new Response(JSON.stringify({ reply, documentId, values: v }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("ChatPanel", () => {
  it("starts with a static greeting and makes no request", () => {
    const fetchMock = mockFetch();
    render(<ChatPanel documentId={null} values={{}} onChange={() => {}} />);
    expect(screen.getByText(/help you draft a legal agreement/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the message and draft, shows the reply and reports the new document and values", async () => {
    const fetchMock = mockFetch(ok("Which city for disputes?"));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel documentId="mutual-nda" values={values} onChange={onChange} />);

    await user.type(screen.getByLabelText("Message"), "Delaware law please");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Which city for disputes?")).toBeInTheDocument();
    expect(screen.getByText("Delaware law please")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith("mutual-nda", { governing_law: "Delaware" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: "user", content: "Delaware law please" }]); // no greeting
    expect(body.documentId).toBe("mutual-nda");
    expect(body.values).toEqual(values);
  });

  it("sends a null document id before one is chosen and passes a null back when none was chosen", async () => {
    const fetchMock = mockFetch(ok("We can't do leases; closest is the Pilot Agreement.", null, {} as never));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel documentId={null} values={{}} onChange={onChange} />);
    await user.type(screen.getByLabelText("Message"), "I need a lease");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(/closest is the Pilot Agreement/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).documentId).toBeNull();
    expect(onChange).toHaveBeenCalledWith(null, {});
  });

  it("ignores empty messages", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup();
    render(<ChatPanel documentId={null} values={{}} onChange={() => {}} />);
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
    render(<ChatPanel documentId={null} values={{}} onChange={onChange} />);

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
    render(<ChatPanel documentId={null} values={{}} onChange={() => {}} />);
    await user.type(screen.getByLabelText("Message"), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });
});
