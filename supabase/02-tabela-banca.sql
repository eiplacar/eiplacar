-- ═══════════════════════════════════════════════════
-- TABELA: banca
-- Usada pela Aba Banca (membros, depósitos, entradas)
-- Guarda tudo numa linha única, em formato JSON
-- ═══════════════════════════════════════════════════

create table if not exists banca (
  id bigint primary key default 1,
  updated_at timestamptz default now(),
  dados jsonb
);
