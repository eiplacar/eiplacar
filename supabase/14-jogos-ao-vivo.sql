-- ═══════════════════════════════════════════════════
-- TABELA: jogos_ao_vivo ("Ao Vivo" no topo do Dashboard)
-- Diferente de "jogos_agendados" (que é cadastrada manualmente pelo
-- organizador), essa tabela é alimentada SOZINHA pelo webhook da GOAL API
-- (netlify/functions/goal-webhook.js) — toda vez que um jogo começa, sai
-- gol ou termina, a GOAL API "empurra" o evento pra gente, sem precisar
-- ficar chamando a API de tempos em tempos (economiza cota/crédito).
--
-- Só é escrita pela função serverless (usa a chave service_role, que
-- ignora RLS). Ninguém no app escreve aqui direto — só lê.
-- Rode no SQL Editor do Supabase, de uma vez só.
-- ═══════════════════════════════════════════════════

create table if not exists jogos_ao_vivo (
  fixture_id bigint primary key,
  camp text,
  pais text,
  casa text not null,
  vis text not null,
  gc int default 0,
  gv int default 0,
  status text default 'agendado', -- agendado | ao_vivo | encerrado
  minuto text,                     -- ex: "45+2", "HT", "FT" (texto livre, como a API mandar)
  horario text,                    -- horário de início (HH:MM, Brasília) — preenchido no match.started
  atualizado_em timestamptz default now()
);

alter table jogos_ao_vivo enable row level security;

-- Qualquer pessoa logada (aprovada, entra pelo app) vê a lista — mesmo
-- padrão de "jogos_agendados". Sem policy de insert/update/delete pra
-- ninguém: só a service_role (webhook) escreve, e ela ignora RLS.
drop policy if exists "jav_select" on jogos_ao_vivo;
create policy "jav_select" on jogos_ao_vivo for select
  using (auth.uid() is not null);
