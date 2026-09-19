"use client";

import { useEffect, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import DocumentPreview from "@/components/DocumentPreview";
import DownloadButton from "@/components/DownloadButton";
import { ChatError, fetchDocument, GENERIC_ERROR } from "@/lib/chat";
import type { DocumentDefinition, DocumentValues } from "@/types/document";

export default function DraftingApp() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [values, setValues] = useState<DocumentValues>({});
  const [definition, setDefinition] = useState<DocumentDefinition | null>(null);
  // Tagged with the document it belongs to, so an old error never shows against a newly chosen document.
  const [loadError, setLoadError] = useState<{ id: string; message: string } | null>(null);
  // Bumped by "Start over"; remounts the chat panel to clear the conversation.
  const [session, setSession] = useState(0);
  // Bumped to retry loading the document definition after an error.
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (documentId === null) return;
    let cancelled = false;
    fetchDocument(documentId)
      .then((loaded) => {
        if (cancelled) return;
        setDefinition(loaded);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError({ id: documentId, message: err instanceof ChatError ? err.message : GENERIC_ERROR });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, loadAttempt]);

  const handleChange = (nextId: string | null, nextValues: DocumentValues) => {
    setDocumentId(nextId);
    setValues(nextValues);
  };

  const startOver = () => {
    setDocumentId(null);
    setValues({});
    setDefinition(null);
    setLoadError(null);
    setSession((n) => n + 1);
  };

  // A definition left over from a previous document must not render with the new document's values.
  const ready = documentId !== null && definition?.id === documentId ? definition : null;
  const visibleError = loadError !== null && loadError.id === documentId ? loadError.message : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 lg:flex-row lg:items-start">
      <section className="w-full lg:sticky lg:top-10 lg:w-[420px] lg:shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-navy">Legal Agreement Assistant</h1>
            <p className="mt-1 text-sm text-black/60">
              Chat with the assistant about the agreement you need. The document on the right fills in as you
              talk, and you can download it as a PDF when you&apos;re done.
            </p>
          </div>
          <button
            type="button"
            onClick={startOver}
            className="shrink-0 rounded-md border border-navy px-3 py-1 text-sm font-medium text-navy transition-colors hover:bg-silver/30 focus:outline-none focus:ring-2 focus:ring-gold"
          >
            Start over
          </button>
        </div>
        <div className="mt-6">
          <ChatPanel key={session} documentId={documentId} values={values} onChange={handleChange} />
        </div>
        {ready ? (
          <div className="mt-6">
            <DownloadButton definition={ready} values={values} />
          </div>
        ) : null}
      </section>

      <section className="min-w-0 flex-1">
        {ready ? (
          <DocumentPreview definition={ready} values={values} />
        ) : visibleError ? (
          <div role="alert" className="rounded-lg border border-navy border-l-4 border-l-gold p-6 text-sm text-black">
            <p>{visibleError}</p>
            <button
              type="button"
              onClick={() => setLoadAttempt((n) => n + 1)}
              className="mt-3 rounded-md border border-navy px-3 py-1 font-medium text-navy hover:bg-silver/30 focus:outline-none focus:ring-2 focus:ring-gold"
            >
              Retry
            </button>
          </div>
        ) : documentId ? (
          <p className="p-6 text-sm italic text-black/60">Loading document…</p>
        ) : (
          <div className="rounded-lg border border-dashed border-silver p-10 text-center text-sm text-black/60">
            Your document will appear here once you and the assistant have chosen one.
          </div>
        )}
      </section>
    </div>
  );
}
