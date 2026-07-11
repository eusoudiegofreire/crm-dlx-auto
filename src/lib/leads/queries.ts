/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ContactRow } from "./types";

const CONTACT_FIELDS = [
  "id",
  "workspace_id",
  "name",
  "phone",
  "email",
  "whatsapp_chat_id",
  "kanban_stage",
  "temperature",
  "procedure_interest",
  "tags",
  "notes",
  "source",
  "created_at",
  "updated_at",
].join(", ");

export async function fetchContacts(supabase: any): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_FIELDS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContactRow[];
}
