# Schema do Banco — DLX Clinic CRM

## Tabelas Novas (coexistem com as 29 tabelas do wacrm antigo)

| Tabela | Descrição |
|---|---|
| `workspaces` | Cada clínica = 1 workspace |
| `profiles` | Usuários vinculados a um workspace |
| `contacts` | Leads/pacientes da clínica |
| `conversations` | Conversa WhatsApp de um contato |
| `messages` | Mensagens individuais de uma conversa |
| `api_keys` | Keys para autenticar o Hermes Agent |

## Pontos de Atenção
- Verificar colisão de nomes com tabelas existentes antes de rodar a migration
- Migration em `supabase/migrations/0001_init.sql` — rodar manualmente no SQL editor
- NÃO rodar `supabase db push` direto — banco tem dados de produção

## RLS
- Todas as tabelas de dados têm RLS habilitado
- Função `get_my_workspace_id()` faz lookup no `profiles` para pegar workspace do usuário logado
- Policy `tenant_isolation` aplica em todas as tabelas

## Colunas Importantes
- `contacts.temperature`: `hot | warm | cold`
- `contacts.kanban_stage`: `novo | qualificado | agendado | compareceu | fechado`
- `conversations.hermes_paused`: quando `true`, Hermes não responde automaticamente
- `messages.sender`: `contact | hermes | agent`
- `profiles.role`: `super_admin | owner | agent | viewer`
