-- ═══════════════════════════════════════════════════
-- Adiciona a coluna `pais` na tabela `jogos`
-- Rode no SQL Editor do Supabase, de uma vez só. Seguro rodar de novo
-- (usa "if not exists" e só faz UPDATE em quem ainda não tem país).
-- ═══════════════════════════════════════════════════

-- 1) Cria a coluna (fica NULL nos jogos que ainda não tiverem país definido)
alter table jogos add column if not exists pais text;

-- 2) Backfill do que já dá pra saber com 100% de certeza: os jogos que acabaram
--    de ser renomeados de "Brasileirão Série A/B" pra "Série A"/"Série B" são
--    todos do Brasil — isso não depende de adivinhar pelo nome, é o mesmo dado
--    que você já tinha antes de renomear.
update jogos set pais = 'Brasil' where camp in ('Série A', 'Série B') and pais is null;

-- 3) Pra qualquer outro campeonato que já exista no banco, revise e preencha
--    manualmente (troque o nome e o país abaixo pra cada caso, e repita a linha
--    quantas vezes precisar). Depois desse passo 3, todo jogo NOVO já vai vir
--    com país preenchido sozinho — só os jogos antigos precisam desse ajuste.
-- update jogos set pais = 'Itália'      where camp = 'Serie A'        and pais is null;
-- update jogos set pais = 'Inglaterra'  where camp = 'Premier League' and pais is null;

-- 4) Conferir o que ficou sem país (se aparecer algo aqui, preencha com um UPDATE acima)
select camp, count(*) as qtd from jogos where pais is null group by camp order by camp;
