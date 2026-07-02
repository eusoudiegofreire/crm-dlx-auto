export type ConversationStatus = "open" | "waiting" | "resolved";
export type MessageSender = "contact" | "hermes" | "agent";

export interface ConversationRow {
  id: string;
  status: ConversationStatus;
  hermes_paused: boolean;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  contacts: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  contact_id: string | null;
  direction: "inbound" | "outbound";
  sender: MessageSender;
  content: string | null;
  created_at: string;
}
