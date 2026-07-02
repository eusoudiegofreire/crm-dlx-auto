import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/api-keys/keys";

export async function GET(request: NextRequest) {
  // 1. Autenticar via Bearer token (mesmo esquema de api_keys que /api/hermes/message)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  const keyHash = hashApiKey(token);
  const admin = createAdminClient();

  const { data: apiKey } = await admin
    .from("api_keys")
    .select("workspace_id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key inválida ou revogada" },
      { status: 401 }
    );
  }

  const workspaceId = apiKey.workspace_id as string;

  // 2. Ler e normalizar o telefone
  const rawPhone = request.nextUrl.searchParams.get("phone");
  if (!rawPhone) {
    return NextResponse.json(
      { error: "Parâmetro phone é obrigatório" },
      { status: 400 }
    );
  }

  const phone = rawPhone.replace(/\D/g, "");
  if (phone.length < 10) {
    return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
  }

  // 3. Buscar contato por telefone
  const { data: contact } = await admin
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("phone", phone)
    .maybeSingle();

  // Contato novo — nunca teve conversa, Sofia responde normalmente
  if (!contact) {
    return NextResponse.json({ hermes_paused: false });
  }

  // 4. Buscar conversa ativa mais recente
  const { data: conversation } = await admin
    .from("conversations")
    .select("hermes_paused")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contact.id)
    .neq("status", "resolved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Nenhuma conversa aberta — Sofia responde normalmente
  if (!conversation) {
    return NextResponse.json({ hermes_paused: false });
  }

  return NextResponse.json({
    hermes_paused: conversation.hermes_paused ?? false,
  });
}
