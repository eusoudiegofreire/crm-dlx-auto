-- =============================================================
-- DLX Clinic CRM — Migration 0002
-- Renomear tabelas do wacrm antigo para prefixo wa_
-- =============================================================
-- EXECUTAR ANTES da 0001_init.sql
--
-- ⚠️  ATENÇÃO: Se o Hermes Agent escreve DIRETAMENTE nessas
-- tabelas via Supabase (sem passar por um backend intermediário),
-- ele vai parar de funcionar após este rename.
-- Confirme com o responsável pelo Hermes antes de rodar.
--
-- O que este script faz:
-- - Renomeia as 5 tabelas que colidem com as novas
-- - Os dados existentes são preservados integralmente
-- - FK constraints e indexes seguem o rename automaticamente
-- =============================================================

ALTER TABLE IF EXISTS profiles      RENAME TO wa_profiles;
ALTER TABLE IF EXISTS contacts      RENAME TO wa_contacts;
ALTER TABLE IF EXISTS conversations RENAME TO wa_conversations;
ALTER TABLE IF EXISTS messages      RENAME TO wa_messages;
ALTER TABLE IF EXISTS api_keys      RENAME TO wa_api_keys;

-- Confirmação: deve retornar as 5 tabelas com prefixo wa_
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name LIKE 'wa_%'
-- ORDER BY table_name;
