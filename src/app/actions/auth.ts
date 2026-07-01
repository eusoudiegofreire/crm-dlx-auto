"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) return { error: "Email ou senha incorretos." };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signupAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const clinicName = (formData.get("clinicName") as string).trim();
  const fullName = (formData.get("fullName") as string).trim();
  const email = (formData.get("email") as string).trim();
  const password = formData.get("password") as string;

  const slug = clinicName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? "Erro ao criar conta." };
  }

  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .insert({ name: clinicName, slug })
    .select()
    .single();

  if (wsError || !workspace) {
    return { error: "Erro ao criar a clínica. O nome pode já estar em uso." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id,
    workspace_id: workspace.id,
    role: "owner",
    full_name: fullName,
  });

  if (profileError) {
    return { error: "Erro ao configurar o perfil. Contate o suporte." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
