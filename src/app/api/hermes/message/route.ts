import { NextRequest, NextResponse } from "next/server";

// Webhook recebido do Hermes Agent (VPS)
// Autenticação via API key no header X-API-Key
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // TODO: verificar key, salvar mensagem, atualizar conversa
  return NextResponse.json({ received: true });
}
