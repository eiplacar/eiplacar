-- ═══════════════════════════════════════════════════
-- TABELA: escudos
-- Guarda os escudos dos times que você sobe no app,
-- pra não sumirem quando o app for atualizado.
-- ═══════════════════════════════════════════════════

create table if not exists escudos (
  id bigint primary key default 1,
  updated_at timestamptz default now(),
  dados jsonb
);
