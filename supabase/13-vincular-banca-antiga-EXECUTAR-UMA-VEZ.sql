-- ═══════════════════════════════════════════════════
-- SCRIPT PESSOAL — rodar UMA VEZ SÓ, não faz parte do setup padrão do projeto
--
-- Antes da Banca virar uma carteira individual por pessoa (ver
-- 02-tabela-banca.sql), existia uma única linha compartilhada na tabela
-- (id=1) usada pelo app inteiro. Esse script pega essa linha antiga e
-- vincula ela à SUA conta específica, pra você não perder o histórico que
-- já tinha lançado ali.
--
-- Se algum dia outra pessoa for configurar esse projeto do zero (banco
-- novo, sem essa linha antiga), esse arquivo não serve pra nada — pode
-- ignorar. Ele só existe pra migrar os dados de quem já vinha usando o
-- sistema desde antes da Banca virar individual.
--
-- Troque o e-mail abaixo se precisar rodar de novo pra outra conta.
-- ═══════════════════════════════════════════════════

update banca set user_id = (select id from auth.users where email = 'paiva.souza@live.com')
  where id = 1 and user_id is null;

-- Confere: deve aparecer sua linha com o user_id preenchido
select id, user_id, updated_at from banca;
