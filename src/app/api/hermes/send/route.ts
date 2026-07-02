import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface SendPayload {
  conversation_id: string;
  message: string;
}

export async function POST(request: NextRequest) {
  // 1. Autenticar via sessão do usuário (cookie, não Bearer)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // 2. Parse do body
  let body: SendPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { conversation_id, message } = body;

  if (!conversation_id || !message?.trim()) {
    return NextResponse.json(
      { error: "conversation_id e message são obrigatórios" },
      { status: 400 }
    );
  }

  const messageText = message.trim();
  const admin = createAdminClient();

  // 3. Buscar workspace do usuário
  const { data: profile } = await admin
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.workspace_id) {
    return NextResponse.json(
      { error: "Workspace não encontrado" },
      { status: 403 }
    );
  }

  const workspaceId = profile.workspace_id as string;

  // 4. Validar que a conversa pertence ao workspace (admin bypassa RLS, validamos manualmente)
  const { data: conversation } = await admin
    .from("conversations")
    .select("id, contact_id")
    .eq("id", conversation_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversa não encontrada" },
      { status: 404 }
    );
  }

  // 5. Buscar telefone do contato
  const { data: contact } = await admin
    .from("contacts")
    .select("id, phone")
    .eq("id", conversation.contact_id)
    .single();

  if (!contact?.phone) {
    return NextResponse.json(
      { error: "Telefone do contato não encontrado" },
      { status: 400 }
    );
  }

  // 6. Inserir mensagem no banco
  const preview =
    messageText.length > 100 ? messageText.slice(0, 100) + "…" : messageText;

  const { data: newMessage, error: msgError } = await admin
    .from("messages")
    .insert({
      workspace_id: workspaceId,
      conversation_id,
      contact_id: contact.id,
      direction: "outbound",
      sender: "agent",
      content: messageText,
    })
    .select("id")
    .single();

  if (msgError || !newMessage) {
    console.error("[hermes/send] Erro ao inserir mensagem:", msgError?.message);
    return NextResponse.json(
      { error: "Erro ao salvar mensagem" },
      { status: 500 }
    );
  }

  // 7. Atualizar metadados da conversa
  await admin
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
    })
    .eq("id", conversation_id);

  // 8. Disparar pro VPS — falha aqui NÃO desfaz o insert acima
  let warning: string | null = null;

  const vpsUrl = process.env.HERMES_VPS_URL;
  const vpsToken = process.env.HERMES_VPS_TOKEN;

  if (!vpsUrl || !vpsToken) {
    console.warn("[hermes/send] HERMES_VPS_URL ou HERMES_VPS_TOKEN não configurados");
    warning =
      "VPS não configurado — mensagem salva no banco mas não enviada ao WhatsApp.";
  } else {
    try {
      const vpsRes = await fetch(`${vpsUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vpsToken}`,
        },
        body: JSON.stringify({
          phone: contact.phone,
          message: messageText,
        }),
        signal: AbortSignal.timeout(8000), // 8s — não pode travar o agente esperando
      });

      if (!vpsRes.ok) {
        const errText = await vpsRes.text().catch(() => "");
        console.error(
          `[hermes/send] VPS retornou ${vpsRes.status}: ${errText}`
        );
        warning =
          "Mensagem salva, mas o servidor WhatsApp retornou erro. Verifique se chegou ao paciente.";
      }
    } catch (err) {
      console.error("[hermes/send] Erro ao contactar VPS:", err);
      warning =
        "Mensagem salva, mas não foi possível contatar o servidor do WhatsApp. Confirme com o paciente.";
    }
  }

  return NextResponse.json({
    status: "ok",
    message_id: newMessage.id,
    ...(warning && { warning }),
  });
}
