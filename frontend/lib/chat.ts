import { postJson, request } from "@/lib/api";
import type { DocumentDefinition, DocumentValues } from "@/types/document";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  documentId: string | null;
  values: DocumentValues;
  /** Set once a document is chosen and the conversation has been saved. */
  draftId: number | null;
}

/** Send the conversation and current draft; get the AI's reply and the updated (and saved) draft. */
export async function sendChat(
  messages: ChatMessage[],
  documentId: string | null,
  values: DocumentValues,
  draftId: number | null,
): Promise<ChatResponse> {
  const response = await postJson("/api/chat", { messages, documentId, values, draftId });
  return response.json();
}

export async function fetchDocument(id: string): Promise<DocumentDefinition> {
  const response = await request(`/api/documents/${encodeURIComponent(id)}`);
  return response.json();
}
