-- ═══════════════════════════════════════════════════
-- Corrige o bug do Pix avulso: pagamento aprovado no Mercado Pago mas
-- a conta continuava marcada como "Teste Grátis" no app.
--
-- Guarda o id do último pagamento Pix avulso já creditado em cada perfil,
-- pra que o acesso seja liberado tanto pelo webhook do Mercado Pago quanto
-- pela tela do app (que fica checando o status a cada poucos segundos
-- enquanto espera a confirmação) — sem correr o risco de creditar o
-- mesmo pagamento duas vezes se os dois chegarem quase ao mesmo tempo.
--
-- Se você já rodou o 04-tabela-perfis.sql atualizado, pode pular este
-- arquivo — a coluna já foi criada junto. Ele existe só pra quem tem o
-- banco de uma versão anterior e prefere rodar só o incremento.
-- ═══════════════════════════════════════════════════

alter table perfis
  add column if not exists assinatura_pix_pagamento_id text;
