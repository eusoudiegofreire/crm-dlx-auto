# DLX Clinic CRM — Especificação do Projeto

## Visão Geral
CRM para clínicas médicas/odontológicas com agente de IA no WhatsApp (Hermes/Sofia).
Modelo de negócio: SaaS multi-tenant.
Cliente piloto: Sorrir Odontologia e Saúde (Porto Velho, RO).

## Stack
- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Banco:** Supabase (`sekodjnmiyymksflhgxk.supabase.co`)
- **Deploy:** Vercel
- **Auth:** Supabase Auth
- **Realtime:** Supabase Realtime (tela de Conversas)

## Princípios de Design (não-negociáveis)
- 100% em português
- Mobile-friendly (recepcionista acessa do celular)
- Dark mode por padrão
- Paleta DLX: `#E84C1F` (laranja/vermelho) + fundo escuro
- Interface simples — usuária-alvo: recepcionista da clínica
- Multi-tenant desde o dia 1: tudo isolado por `workspace_id` com RLS no Supabase

## Domínio
- **Workspace** = clínica
- **Contact** = lead/paciente
- **Conversation** = conversa no WhatsApp
- **Message** = mensagem individual
- **Hermes** = agente de IA (já em produção no VPS — não mexa)

## Roles de Usuário
- `super_admin` — DLX (acesso total a todos os workspaces)
- `owner` — dono da clínica
- `agent` — recepcionista/atendente
- `viewer` — somente leitura

## Kanban de Leads
Estágios: `novo` → `qualificado` → `agendado` → `compareceu` → `fechado`

## Temperatura dos Leads
- `hot` — pronto pra fechar
- `warm` — interessado mas hesitante
- `cold` — novo ou sem resposta

## Integrações
- **Hermes Agent** (VPS): recebe/envia mensagens via webhook `/api/hermes/message`
- **Supabase Realtime**: atualização em tempo real das conversas
