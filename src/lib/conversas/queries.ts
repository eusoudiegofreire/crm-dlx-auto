/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ConversationRow, MessageRow } from "./types";

export async function fetchConversations(supabase: any): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, status, hermes_paused, unread_count, last_message_at, last_message_preview, contacts(id, name, phone)"
    )
    .order("last_message_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ConversationRow[];
}

export async function fetchMessages(
  supabase: any,
  conversationId: string
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, contact_id, direction, sender, content, created_at"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MessageRow[];
}
