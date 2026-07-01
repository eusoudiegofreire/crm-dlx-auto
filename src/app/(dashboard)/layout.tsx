import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sem env vars configuradas, não tenta criar o client (evita crash na Vercel)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect("/login");
  }

  const supabase = await createClient();

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Falha de conexão — redireciona para login
  }

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
