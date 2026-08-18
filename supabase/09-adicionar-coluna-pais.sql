-- ═══════════════════════════════════════════════════
-- Adiciona a coluna `pais` na tabela `jogos`
-- Rode no SQL Editor do Supabase, de uma vez só. Seguro rodar de novo
-- (usa "if not exists" e só faz UPDATE em quem ainda não tem país).
-- ═══════════════════════════════════════════════════

-- 1) Cria a coluna (fica NULL nos jogos que ainda não tiverem país definido)
alter table jogos add column if not exists pais text;

-- 2) Backfill do que já dá pra saber com 100% de certeza: jogos do Brasileirão
--    são todos do Brasil.
update jogos set pais = 'Brasil' where camp in ('Brasileirão Série A', 'Brasileirão Série B') and pais is null;

-- 3) Pra qualquer outro campeonato que já exista no banco, revise e preencha
--    manualmente (troque o nome e o país abaixo pra cada caso, e repita a linha
--    quantas vezes precisar). Depois desse passo 3, todo jogo NOVO já vai vir
--    com país preenchido sozinho — só os jogos antigos precisam desse ajuste.
--    Lista organizada por país, com os nomes de campeonato exatamente como
--    aparecem em NOMES_CAMP_POR_LIGA (jogos-do-dia.js / atualizar-jogos-finalizados.js):
-- update jogos set pais = 'Inglaterra'  where camp = 'Premier League'         and pais is null;
-- update jogos set pais = 'Espanha'     where camp = 'La Liga'                and pais is null;
-- update jogos set pais = 'Alemanha'    where camp = 'Bundesliga'             and pais is null;
-- update jogos set pais = 'Alemanha'    where camp = '2. Bundesliga'          and pais is null;
-- update jogos set pais = 'Itália'      where camp = 'Serie A'                and pais is null;
-- update jogos set pais = 'Portugal'    where camp = 'Primeira Liga'          and pais is null;
-- update jogos set pais = 'Holanda'     where camp = 'Eredivisie'             and pais is null;
-- update jogos set pais = 'França'      where camp = 'Ligue 1'                and pais is null;
-- update jogos set pais = 'México'      where camp = 'Liga MX'                and pais is null;
-- update jogos set pais = 'Europa'      where camp = 'UEFA Champions League'  and pais is null;

-- 4) Conferir o que ficou sem país (se aparecer algo aqui, preencha com um UPDATE acima)
select camp, count(*) as qtd from jogos where pais is null group by camp order by camp;
