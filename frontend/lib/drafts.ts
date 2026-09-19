import { request } from "@/lib/api";
import type { ChatMessage } from "@/lib/chat";
import type { DocumentValues } from "@/types/document";

export interface DraftSummary {
  id: number;
  documentId: string;
  documentName: string;
  /** Company names filled in so far. */
  parties: string[];
  updatedAt: string;
}

export interface DraftDetail {
  id: number;
  documentId: string;
  values: DocumentValues;
  messages: ChatMessage[];
  updatedAt: string;
}

export async function listDrafts(): Promise<DraftSummary[]> {
  return (await request("/api/drafts")).json();
}

export async function getDraft(id: number): Promise<DraftDetail> {
  return (await request(`/api/drafts/${id}`)).json();
}

export async function deleteDraft(id: number): Promise<void> {
  await request(`/api/drafts/${id}`, { method: "DELETE" });
}
