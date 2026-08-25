-- ═══════════════════════════════════════════════════
-- LIMPEZA: remove a tabela "jogos_ao_vivo" e o card "Ao Vivo" do Dashboard.
-- O webhook da GOAL API que alimentava essa tabela foi desativado (custo alto
-- de créditos, ~46 requisições/1 falha por chamada de teste, endpoint nunca
-- chegou a receber evento real de jogo). A função netlify/functions/goal-webhook.js
-- e o script public/js/18-ao-vivo.js já foram removidos do projeto.
--
-- Rode no SQL Editor do Supabase, uma vez só.
-- ═══════════════════════════════════════════════════

drop table if exists jogos_ao_vivo;
