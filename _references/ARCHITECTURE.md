# Arquitetura — DLX Clinic CRM

## Estrutura de Pastas (src/)
```
src/
├── app/
│   ├── (auth)/              # Rotas públicas (fora do dashboard)
│   │   ├── login/
│   │   └── cadastro/
│   ├── (dashboard)/         # Rotas protegidas — requerem auth
│   │   ├── layout.tsx       # Sidebar + Header
│   │   ├── dashboard/
│   │   ├── conversas/       # Realtime — chat ao vivo
│   │   ├── leads/           # Kanban
│   │   ├── contatos/        # Lista de contatos
│   │   └── configuracoes/
│   └── api/
│       └── hermes/message/  # Webhook recebido do VPS do Hermes
├── components/
│   ├── layout/              # Sidebar, Header
│   ├── conversas/           # Componentes da tela de chat
│   ├── leads/               # Kanban cards, colunas
│   └── ui/                  # shadcn/ui components (auto-gerado)
└── lib/
    ├── supabase/
    │   ├── client.ts        # Browser client (createBrowserClient)
    │   └── server.ts        # Server client (createServerClient com cookies)
    └── api-keys/
        └── keys.ts          # Geração/verificação de API keys (HMAC)
```

## Fluxo de Autenticação
1. Usuário acessa `/login` → autentica via Supabase Auth
2. Middleware do Next.js verifica sessão → redireciona se não autenticado
3. `profiles` table vincula `auth.users` ao workspace correto
4. RLS garante isolamento: cada query retorna só dados do workspace do usuário

## Fluxo Hermes → CRM
1. Hermes (VPS) envia POST para `/api/hermes/message` com API key no header
2. Route handler verifica a key (hash), identifica workspace
3. Salva mensagem em `messages`, atualiza `conversations`
4. Supabase Realtime notifica o frontend em tempo real

## Multi-tenancy
- Toda tabela tem `workspace_id uuid NOT NULL`
- RLS usa função `get_my_workspace_id()` para filtrar automaticamente
- API keys pertencem a um workspace e autenticam requests do Hermes
