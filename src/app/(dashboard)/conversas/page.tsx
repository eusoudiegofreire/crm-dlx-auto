import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversasClient } from "@/components/conversas";
import { fetchConversations } from "@/lib/conversas/queries";
import type { ConversationRow } from "@/lib/conversas/types";

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
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

  // contact_id vindo do kanban (/conversas?contact=<uuid>)
  const params = await searchParams;
  const initialContactId = params.contact ?? null;

  let conversations: ConversationRow[] = [];
  if (workspaceId) {
    try {
      conversations = await fetchConversations(supabase);
    } catch (e) {
      console.error("[conversas] fetchConversations error:", e);
    }
  }

  return (
    <ConversasClient
      initialConversations={conversations}
      workspaceId={workspaceId}
      initialContactId={initialContactId}
    />
  );
}
