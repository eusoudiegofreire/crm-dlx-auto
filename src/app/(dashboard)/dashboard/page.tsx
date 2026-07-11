import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard";

export default async function DashboardPage() {
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

  if (!workspaceId) {
    return <DashboardClient contacts={[]} conversations={[]} messages={[]} />;
  }

  const since30d = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    { data: contacts },
    { data: conversations },
    { data: messages },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, kanban_stage, temperature, created_at"),
    supabase
      .from("conversations")
      .select(
        "id, contact_id, status, unread_count, last_message_at, created_at, contacts(id, name)"
      )
      .order("last_message_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id, direction, sender, created_at")
      .gte("created_at", since30d),
  ]);

  return (
    <DashboardClient
      contacts={contacts ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conversations={(conversations ?? []) as any[]}
      messages={messages ?? []}
    />
  );
}
