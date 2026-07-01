-- =============================================================
-- DLX Clinic CRM — Migration 0001: schema inicial
-- =============================================================
-- ATENÇÃO: antes de rodar, execute o script de verificação abaixo
-- para checar colisões com as 29 tabelas do wacrm:
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN (
--     'workspaces', 'profiles', 'contacts',
--     'conversations', 'messages', 'api_keys'
--   );
--
-- Tabelas com ALTO risco de já existir no wacrm:
--   ⚠️  contacts       (nome genérico, muito comum)
--   ⚠️  conversations  (nome genérico, muito comum)
--   ⚠️  messages       (nome genérico, muito comum)
--   ⚠️  profiles       (padrão Supabase Auth)
--   ℹ️  workspaces     (risco médio)
--   ℹ️  api_keys       (risco médio)
--
-- Se alguma colidir, renomeie ANTES de rodar (ex: clinic_contacts).
-- =============================================================

-- Workspaces (clínicas)
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text DEFAULT 'starter',
  logo_url text,
  primary_color text DEFAULT '#E84C1F',
  whatsapp_number text,
  hermes_active boolean DEFAULT true,
  hermes_prompt text,
  created_at timestamptz DEFAULT now()
);

-- Profiles (usuários vinculados ao workspace)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  workspace_id uuid REFERENCES workspaces,
  role text DEFAULT 'agent', -- 'super_admin' | 'owner' | 'agent' | 'viewer'
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Contacts (leads/pacientes)
CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces,
  name text NOT NULL,
  phone text,
  email text,
  procedure_interest text,
  temperature text DEFAULT 'cold', -- 'hot' | 'warm' | 'cold'
  kanban_stage text DEFAULT 'novo', -- novo | qualificado | agendado | compareceu | fechado
  source text DEFAULT 'whatsapp',
  notes text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Conversations
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces,
  contact_id uuid REFERENCES contacts,
  status text DEFAULT 'open', -- 'open' | 'waiting' | 'resolved'
  hermes_paused boolean DEFAULT false,
  assigned_to uuid REFERENCES profiles,
  unread_count integer DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces,
  conversation_id uuid NOT NULL REFERENCES conversations,
  contact_id uuid REFERENCES contacts,
  direction text NOT NULL, -- 'inbound' | 'outbound'
  sender text NOT NULL,    -- 'contact' | 'hermes' | 'agent'
  content text,
  media_url text,
  media_type text,         -- 'audio' | 'image' | 'document'
  created_at timestamptz DEFAULT now()
);

-- API Keys (autenticação do Hermes Agent)
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_by uuid REFERENCES profiles,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =============================================================
-- Índices para performance
-- =============================================================
CREATE INDEX idx_contacts_workspace ON contacts (workspace_id);
CREATE INDEX idx_contacts_phone ON contacts (phone);
CREATE INDEX idx_conversations_workspace ON conversations (workspace_id);
CREATE INDEX idx_conversations_contact ON conversations (contact_id);
CREATE INDEX idx_conversations_last_message ON conversations (workspace_id, last_message_at DESC);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_workspace ON messages (workspace_id);
CREATE INDEX idx_api_keys_hash ON api_keys (key_hash);

-- =============================================================
-- Trigger: atualiza contacts.updated_at automaticamente
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- RLS — Row Level Security
-- =============================================================
ALTER TABLE workspaces    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys      ENABLE ROW LEVEL SECURITY;

-- Função helper: retorna workspace_id do usuário logado
CREATE OR REPLACE FUNCTION get_my_workspace_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT workspace_id FROM profiles WHERE id = auth.uid()
$$;

-- Políticas de isolamento por tenant
CREATE POLICY "tenant_isolation" ON contacts
  USING (workspace_id = get_my_workspace_id());

CREATE POLICY "tenant_isolation" ON conversations
  USING (workspace_id = get_my_workspace_id());

CREATE POLICY "tenant_isolation" ON messages
  USING (workspace_id = get_my_workspace_id());

CREATE POLICY "tenant_isolation" ON api_keys
  USING (workspace_id = get_my_workspace_id());

-- Cada usuário vê só o próprio profile
CREATE POLICY "own_profile" ON profiles
  USING (id = auth.uid());

-- Workspace: usuário vê só o seu
CREATE POLICY "own_workspace" ON workspaces
  USING (id = get_my_workspace_id());

-- =============================================================
-- Realtime: habilitar para conversas e mensagens
-- (rodar separado se preferir via Dashboard)
-- =============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
