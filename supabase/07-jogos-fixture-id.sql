-- ═══════════════════════════════════════════════════
-- COLUNA: jogos.fixture_id
-- Guarda o ID do jogo na API-Football, pra podermos
-- identificar "esse jogo já foi importado" e nunca
-- duplicar nem gastar cota da API de novo à toa.
-- ═══════════════════════════════════════════════════

alter table jogos
  add column if not exists fixture_id bigint,
  add column if not exists origem text default 'manual'; -- 'manual' ou 'api-football'

create unique index if not exists jogos_fixture_id_unique
  on jogos (fixture_id)
  where fixture_id is not null;
