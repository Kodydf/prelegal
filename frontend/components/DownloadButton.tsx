"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import NdaPdfDocument from "@/lib/pdf/NdaPdfDocument";
import type { NdaFormData } from "@/types/nda";

function fileNameFor(data: NdaFormData): string {
  const parties = [data.partyOne.company, data.partyTwo.company]
    .map((name) => name.trim())
    .filter(Boolean);
  const base = parties.length > 0 ? `Mutual-NDA-${parties.join("-and-")}` : "Mutual-NDA";
  return `${base.replace(/[^a-zA-Z0-9-]+/g, "-")}.pdf`;
}

export default function DownloadButton({ data }: { data: NdaFormData }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await pdf(<NdaPdfDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFor(data);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate NDA PDF:", err);
      setError("Something went wrong generating the PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isGenerating}
        className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isGenerating ? "Preparing PDF…" : "Download as PDF"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
