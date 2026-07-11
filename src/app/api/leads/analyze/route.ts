import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { contact_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.contact_id) {
    return NextResponse.json(
      { error: "contact_id é obrigatório" },
      { status: 400 }
    );
  }

  // TODO: implementar análise real com IA
  // 1. Buscar mensagens da conversa do contato (messages WHERE contact_id = body.contact_id)
  // 2. Chamar Claude/Hermes para analisar a conversa e inferir:
  //    - temperature: "hot" | "warm" | "cold"
  //    - kanban_stage: sugestão de próxima etapa
  //    - procedure_interest: procedimento detectado no texto
  //    - notes: resumo da conversa
  // 3. Atualizar contacts SET temperature, kanban_stage, procedure_interest, notes WHERE id = contact_id

  return NextResponse.json({ ok: true, mock: true });
}
