-- ═══════════════════════════════════════════════════
-- MANUTENÇÃO: apagar campeonatos indesejados na tabela `jogos`
-- Rode no SQL Editor do Supabase, de cima pra baixo, de uma vez só.
-- Script separado do projeto — não faz parte do app, não roda sozinho.
-- ═══════════════════════════════════════════════════

-- 0) Opcional: conferir os nomes exatos que existem hoje, ANTES de mexer
--    (rode só essa linha primeiro se quiser ver o que tem no banco)
select camp, count(*) as qtd from jogos group by camp order by camp;

-- 1) Apagar jogos de amistoso internacional
--    Usa "contém" (%...%) em vez de nome exato, pra pegar variações tipo
--    "Amistoso Internacional", "Amistosos Internacionais" etc. Se você
--    tiver amistosos de outro tipo que QUER manter, troque a linha de
--    baixo pelo nome exato: where camp = 'Amistoso Internacional';
delete from jogos where camp ilike '%amistoso internacional%';

-- 2) Conferir o resultado final
select camp, count(*) as qtd from jogos group by camp order by camp;

