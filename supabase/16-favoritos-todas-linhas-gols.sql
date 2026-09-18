-- ═══════════════════════════════════════════════════
-- favoritos_indice: guarda as 4 linhas de Gols (1.5/2.5/3.5/4.5), não só as 2 mais
-- pontuadas — o card de Favoritos agora mostra sempre os 6 mercados (Resultado, Ambas
-- Marcam, +1.5, +2.5, +3.5, +4.5). Rode no SQL Editor do Supabase, de uma vez só.
-- Seguro rodar de novo — só adiciona coluna se ela ainda não existir.
-- ═══════════════════════════════════════════════════

alter table favoritos_indice add column if not exists gols_linha3 text;
alter table favoritos_indice add column if not exists gols_prob3 int;
alter table favoritos_indice add column if not exists gols_linha4 text;
alter table favoritos_indice add column if not exists gols_prob4 int;
