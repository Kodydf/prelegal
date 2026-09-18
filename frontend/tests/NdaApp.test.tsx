import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import NdaApp from "@/components/NdaApp";
import { defaultNdaFormData } from "@/lib/nda-defaults";

// The PDF renderer isn't needed here and is heavy in jsdom.
vi.mock("@/components/DownloadButton", () => ({ default: () => <button>Download as PDF</button> }));

afterEach(() => vi.unstubAllGlobals());

describe("NdaApp", () => {
  it("fills the document preview with the fields the AI returns", async () => {
    const fields = {
      ...defaultNdaFormData,
      governingLaw: "Delaware",
      partyOne: { ...defaultNdaFormData.partyOne, company: "Northwind Inc" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: "Noted!", fields }), { status: 200 })),
    );
    const user = userEvent.setup();
    render(<NdaApp />);
    expect(screen.queryByText("Northwind Inc")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Message"), "Northwind, Delaware");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Noted!")).toBeInTheDocument();
    expect((await screen.findAllByText("Northwind Inc")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Delaware/).length).toBeGreaterThan(0);
  });
});
