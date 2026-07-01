import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Busca perfil e workspace — com fallback caso a migration ainda não tenha sido rodada
  let clinicName = "Minha Clínica";
  let userInitials = (user.email?.[0] ?? "U").toUpperCase();

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, workspace_id")
      .eq("id", user.id)
      .single();

    if (profile) {
      const fullName = profile.full_name ?? user.email ?? "";
      userInitials =
        fullName
          .split(" ")
          .slice(0, 2)
          .map((n: string) => n[0]?.toUpperCase())
          .filter(Boolean)
          .join("") || userInitials;

      if (profile.workspace_id) {
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", profile.workspace_id)
          .single();
        clinicName = workspace?.name ?? "Minha Clínica";
      }
    }
  } catch {
    // Tabelas ainda não existem — mostra fallback
  }

  return (
    <DashboardShell clinicName={clinicName} userInitials={userInitials}>
      {children}
    </DashboardShell>
  );
}
