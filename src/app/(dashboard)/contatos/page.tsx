import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContatosClient } from "@/components/contatos";
import type { ContactRow } from "@/lib/leads/types";

const CONTACT_FIELDS =
  "id, workspace_id, name, phone, email, whatsapp_chat_id, kanban_stage, temperature, procedure_interest, tags, notes, source, created_at, updated_at";

export default async function ContatosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  const workspaceId = (profile?.workspace_id as string | null) ?? "";

  let contacts: ContactRow[] = [];
  if (workspaceId) {
    const { data } = await supabase
      .from("contacts")
      .select(CONTACT_FIELDS)
      .order("created_at", { ascending: false })
      .limit(50);
    contacts = (data ?? []) as ContactRow[];
  }

  return (
    <ContatosClient initialContacts={contacts} workspaceId={workspaceId} />
  );
}
