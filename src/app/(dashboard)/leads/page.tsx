import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeadsClient } from "@/components/leads";
import { fetchContacts } from "@/lib/leads/queries";
import type { ContactRow } from "@/lib/leads/types";

export default async function LeadsPage() {
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
    try {
      contacts = await fetchContacts(supabase);
    } catch (e) {
      console.error("[leads] fetchContacts error:", e);
    }
  }

  return <LeadsClient initialContacts={contacts} workspaceId={workspaceId} />;
}
