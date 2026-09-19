"use client";

import { useEffect, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import { Alert, buttonClass } from "@/components/ui";
import DocumentPreview from "@/components/DocumentPreview";
import DownloadButton from "@/components/DownloadButton";
import { errorMessage } from "@/lib/api";
import { fetchDocument } from "@/lib/chat";
import { DRAFT_REMINDER } from "@/lib/disclaimer";
import type { DraftDetail } from "@/lib/drafts";
import type { DocumentDefinition, DocumentValues } from "@/types/document";

interface DraftingAppProps {
  /** A saved draft to continue, or null/undefined to start a new document. */
  initialDraft?: DraftDetail | null;
}

export default function DraftingApp({ initialDraft = null }: DraftingAppProps) {
  const [documentId, setDocumentId] = useState<string | null>(initialDraft?.documentId ?? null);
  const [values, setValues] = useState<DocumentValues>(initialDraft?.values ?? {});
  const [draftId, setDraftId] = useState<number | null>(initialDraft?.id ?? null);
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
          setLoadError({ id: documentId, message: errorMessage(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, loadAttempt]);

  const handleChange = (nextId: string | null, nextValues: DocumentValues, nextDraftId: number | null) => {
    setDocumentId(nextId);
    setValues(nextValues);
    setDraftId(nextDraftId);
  };

  const startOver = () => {
    setDocumentId(null);
    setValues({});
    setDraftId(null);
    setDefinition(null);
    setLoadError(null);
    setSession((n) => n + 1);
  };

  // A definition left over from a previous document must not render with the new document's values.
  const ready = documentId !== null && definition?.id === documentId ? definition : null;
  // "Continue" only describes the very first session; after Start over it is a brand-new document again.
  const isResuming = initialDraft !== null && session === 0;
  const visibleError = loadError !== null && loadError.id === documentId ? loadError.message : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8 lg:flex-row lg:items-start">
      <section className="w-full lg:sticky lg:top-6 lg:w-[420px] lg:shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-navy">
              {isResuming ? "Continue your document" : "Draft a new document"}
            </h1>
            <p className="mt-1 text-sm text-black/60">
              Chat with the assistant about the agreement you need. The document on the right fills in as you talk,
              and it is saved automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={startOver}
            className={`${buttonClass} shrink-0`}
          >
            Start over
          </button>
        </div>
        <div className="mt-5">
          <ChatPanel
            key={session}
            documentId={documentId}
            values={values}
            draftId={draftId}
            initialMessages={session === 0 ? initialDraft?.messages : undefined}
            onChange={handleChange}
          />
        </div>
        {ready ? (
          <div className="mt-5">
            <DownloadButton definition={ready} values={values} />
            <p className="mt-3 text-xs text-black/60">{DRAFT_REMINDER}</p>
          </div>
        ) : null}
      </section>

      <section className="min-w-0 flex-1">
        {ready ? (
          <DocumentPreview definition={ready} values={values} />
        ) : visibleError ? (
          <Alert className="p-6">
            <p>{visibleError}</p>
            <button type="button" onClick={() => setLoadAttempt((n) => n + 1)} className={`${buttonClass} mt-3`}>
              Retry
            </button>
          </Alert>
        ) : documentId ? (
          <p className="p-6 text-sm italic text-black/60">Loading document…</p>
        ) : (
          <div className="rounded-xl border border-dashed border-silver p-10 text-center text-sm text-black/60">
            Your document will appear here once you and the assistant have chosen one.
          </div>
        )}
      </section>
    </div>
  );
}
