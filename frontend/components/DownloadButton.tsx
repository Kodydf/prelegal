"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Alert, primaryButtonClass } from "@/components/ui";
import DocumentPdf from "@/lib/pdf/DocumentPdf";
import type { DocumentDefinition, DocumentValues } from "@/types/document";

function fileNameFor(definition: DocumentDefinition, values: DocumentValues): string {
  const companies = definition.parties
    .map((party) => (values[`${party.key}_company`] ?? "").trim())
    .filter(Boolean);
  const base = [definition.name, ...(companies.length > 0 ? [companies.join(" and ")] : [])].join(" ");
  return `${base.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
}

interface DownloadButtonProps {
  definition: DocumentDefinition;
  values: DocumentValues;
}

export default function DownloadButton({ definition, values }: DownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await pdf(<DocumentPdf definition={definition} values={values} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFor(definition, values);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
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
        className={`${primaryButtonClass} inline-flex items-center justify-center px-5 py-2.5`}
      >
        {isGenerating ? "Preparing PDF…" : "Download as PDF"}
      </button>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
