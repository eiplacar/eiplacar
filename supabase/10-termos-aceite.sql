-- ═══════════════════════════════════════════════════
-- COLUNA: perfis.termos_aceitos_em
-- Guarda a data/hora em que a pessoa aceitou os Termos de Uso
-- e a Política de Privacidade no cadastro — serve de comprovante
-- caso precise confirmar depois que o aceite aconteceu.
-- Rode no SQL Editor do Supabase. Seguro rodar de novo.
-- ═══════════════════════════════════════════════════

alter table perfis
  add column if not exists termos_aceitos_em timestamptz;

-- Conferir quem já tem aceite registrado (jogos/cadastros feitos ANTES dessa
-- mudança ficam com null aqui — não tem como saber retroativamente se aceitaram,
-- já que a tela de termos não existia ainda).
select
  count(*) filter (where termos_aceitos_em is not null) as com_aceite,
  count(*) filter (where termos_aceitos_em is null)     as sem_aceite
from perfis;
