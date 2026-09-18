import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "@/components/ChatPanel";
import { defaultNdaFormData } from "@/lib/nda-defaults";
import type { NdaFormData } from "@/types/nda";

const updated: NdaFormData = { ...defaultNdaFormData, governingLaw: "Delaware" };

function mockFetch(...responses: Array<Response | Error>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ok = (reply: string, fields = updated) =>
  new Response(JSON.stringify({ reply, fields }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("ChatPanel", () => {
  it("starts with a static greeting and makes no request", () => {
    const fetchMock = mockFetch();
    render(<ChatPanel data={defaultNdaFormData} onChange={() => {}} />);
    expect(screen.getByText(/help you draft a Mutual NDA/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the message, shows the reply and updates the document fields", async () => {
    const fetchMock = mockFetch(ok("Which city for disputes?"));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel data={defaultNdaFormData} onChange={onChange} />);

    await user.type(screen.getByLabelText("Message"), "Delaware law please");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Which city for disputes?")).toBeInTheDocument();
    expect(screen.getByText("Delaware law please")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(updated);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: "user", content: "Delaware law please" }]); // no greeting
    expect(body.fields).toEqual(defaultNdaFormData);
  });

  it("ignores empty messages", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup();
    render(<ChatPanel data={defaultNdaFormData} onChange={() => {}} />);
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
    render(<ChatPanel data={defaultNdaFormData} onChange={onChange} />);

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
    render(<ChatPanel data={defaultNdaFormData} onChange={() => {}} />);
    await user.type(screen.getByLabelText("Message"), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });
});

describe("wire format contract", () => {
  it("default fields use the same keys as the backend NdaFields model", () => {
    // Keep in sync with backend/tests/test_chat.py::test_wire_format_keys_match_frontend_contract.
    expect(Object.keys(defaultNdaFormData).sort()).toEqual(
      [
        "purpose", "effectiveDate", "mndaTermType", "mndaTermYears", "confidentialityTermType",
        "confidentialityTermYears", "governingLaw", "jurisdiction", "modifications", "partyOne", "partyTwo",
      ].sort(),
    );
    expect(Object.keys(defaultNdaFormData.partyOne).sort()).toEqual(
      ["printName", "title", "company", "noticeAddress", "date"].sort(),
    );
  });
});
