-- ═══════════════════════════════════════════════════
-- TABELA: jogos
-- Usada pela Aba Dados / Cadastrar Jogo (H2H)
-- ═══════════════════════════════════════════════════

create table if not exists jogos (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  camp text, data text, rodada text,
  local text, casa text, vis text,
  "gC" int, "gV" int,
  "rankC" int, "rankV" int,
  gols jsonb,
  "golsHT_C" int, "golsHT_V" int,
  "chutesC" int, "chutesV" int,
  "chutesGolC" int, "chutesGolV" int,
  "escanteiosC" int, "escanteiosV" int,
  "amarelosC" int, "amarelosV" int,
  "vermelhosC" int, "vermelhosV" int
);
