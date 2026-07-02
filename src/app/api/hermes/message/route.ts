import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/api-keys/keys";

interface HermesPayload {
  contact_phone: string;
  contact_chat_id?: string | null;
  contact_name?: string | null;
  message: string;
  direction: "inbound" | "outbound";
}

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação via Bearer token
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

    // 2. Validar payload
    let body: HermesPayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
    }

    const { contact_phone, contact_chat_id, contact_name, message, direction } = body;

    if (!contact_phone || !message || !direction) {
      return NextResponse.json(
        { error: "Campos obrigatórios: contact_phone, message, direction" },
        { status: 400 }
      );
    }

    if (direction !== "inbound" && direction !== "outbound") {
      return NextResponse.json(
        { error: "direction deve ser 'inbound' ou 'outbound'" },
        { status: 400 }
      );
    }

    // 3. Normalizar telefone (remove tudo que não é dígito)
    const phone = contact_phone.replace(/\D/g, "");
    if (phone.length < 10) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
    }

    // 4. Buscar ou criar contato
    const { data: existingContact } = await admin
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("phone", phone)
      .maybeSingle();

    let contactId: string;

    if (existingContact) {
      contactId = existingContact.id as string;
      // Atualiza whatsapp_chat_id se veio preenchido (não sobrescreve com null)
      if (contact_chat_id) {
        await admin
          .from("contacts")
          .update({ whatsapp_chat_id: contact_chat_id })
          .eq("id", contactId);
      }
    } else {
      const { data: newContact, error: contactError } = await admin
        .from("contacts")
        .insert({
          workspace_id: workspaceId,
          name: contact_name?.trim() || phone,
          phone,
          source: "whatsapp",
          ...(contact_chat_id ? { whatsapp_chat_id: contact_chat_id } : {}),
        })
        .select("id")
        .single();

      if (contactError || !newContact) {
        console.error("[hermes] Erro ao criar contato:", contactError?.message);
        return NextResponse.json(
          { error: "Erro ao criar contato" },
          { status: 500 }
        );
      }
      contactId = newContact.id as string;
    }

    // 5. Buscar ou criar conversa aberta (status != resolved)
    const { data: convRows } = await admin
      .from("conversations")
      .select("id, unread_count")
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contactId)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(1);

    const existingConv = convRows?.[0] ?? null;
    let conversationId: string;
    let currentUnread = 0;

    if (existingConv) {
      conversationId = existingConv.id as string;
      currentUnread = (existingConv.unread_count as number) ?? 0;
    } else {
      const { data: newConv, error: convError } = await admin
        .from("conversations")
        .insert({
          workspace_id: workspaceId,
          contact_id: contactId,
          status: "open",
          unread_count: 0,
        })
        .select("id")
        .single();

      if (convError || !newConv) {
        console.error("[hermes] Erro ao criar conversa:", convError?.message);
        return NextResponse.json(
          { error: "Erro ao criar conversa" },
          { status: 500 }
        );
      }
      conversationId = newConv.id as string;
    }

    // 6. Inserir mensagem
    const { data: newMessage, error: msgError } = await admin
      .from("messages")
      .insert({
        workspace_id: workspaceId,
        conversation_id: conversationId,
        contact_id: contactId,
        direction,
        sender: direction === "inbound" ? "contact" : "hermes",
        content: message,
      })
      .select("id")
      .single();

    if (msgError || !newMessage) {
      console.error("[hermes] Erro ao salvar mensagem:", msgError?.message);
      return NextResponse.json(
        { error: "Erro ao salvar mensagem" },
        { status: 500 }
      );
    }

    // 7. Atualizar metadados da conversa
    const preview = message.length > 100 ? message.slice(0, 100) + "…" : message;

    await admin
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
        ...(direction === "inbound" && { unread_count: currentUnread + 1 }),
      })
      .eq("id", conversationId);

    return NextResponse.json({
      status: "ok",
      message_id: newMessage.id,
    });
  } catch (err) {
    console.error("[hermes] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
