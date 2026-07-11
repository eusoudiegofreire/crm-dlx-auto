import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracoesClient } from "@/components/configuracoes";

export default async function ConfiguracoesPage() {
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

  let workspace = null;
  if (workspaceId) {
    const { data } = await supabase
      .from("workspaces")
      .select(
        "id, name, slug, logo_url, primary_color, whatsapp_number, plan, created_at"
      )
      .eq("id", workspaceId)
      .single();
    workspace = data;
  }

  return <ConfiguracoesClient initialWorkspace={workspace} />;
}
