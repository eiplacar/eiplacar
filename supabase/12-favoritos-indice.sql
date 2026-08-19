-- ═══════════════════════════════════════════════════
-- TABELA: favoritos_indice ("⭐ Favoritar" na aba Análise → Índice)
-- Guarda o resultado da Favorita Ponto (Resultado/Gols/BTTS) de um confronto.
-- Diferente dos "Jogos Agendados" (que são compartilhados), aqui é PRIVADO —
-- cada conta só vê e favorita os SEUS próprios confrontos analisados. Some
-- da lista sozinho 4h depois de favoritado (feito na TELA, igual o de lá —
-- não precisa apagar linha nenhuma aqui pra "sumir da lista").
--
-- Regras:
--   • Cada pessoa só vê e favorita os PRÓPRIOS confrontos (não é compartilhado).
--   • Só quem favoritou pode remover.
-- Rode no SQL Editor do Supabase, de uma vez só.
-- ═══════════════════════════════════════════════════

create table if not exists favoritos_indice (
  id bigint generated always as identity primary key,
  camp text,
  casa text not null,
  vis text not null,

  resultado_favorito text,        -- nome do time (casa ou vis) apontado como Favorita Ponto
  resultado_pontuacao int,        -- 0-100
  resultado_classificacao text,   -- Muito forte / Forte / Favorável / Moderado / Baixo / Muito baixo
  resultado_alerta boolean default false, -- true quando a probabilidade (Poisson) diverge da Favorita Ponto

  gols_pontuacao int,
  gols_classificacao text,
  gols_linha1 text,               -- linha de Over mais bem pontuada (ex: "1.5")
  gols_prob1 int,                 -- probabilidade dessa linha (%)
  gols_linha2 text,               -- 2ª linha mais bem pontuada (ex: "2.5")
  gols_prob2 int,

  btts_pontuacao int,
  btts_classificacao text,
  btts_pct int,                   -- % de Ambas Marcam (Sim)

  criado_por uuid references auth.users(id),
  criado_em timestamptz default now()
);

-- Se você rodou uma versão anterior deste script (com a coluna única "gols_linha"),
-- isso aqui adiciona as colunas novas sem perder o que já existe. Seguro rodar de novo.
alter table favoritos_indice add column if not exists gols_linha1 text;
alter table favoritos_indice add column if not exists gols_prob1 int;
alter table favoritos_indice add column if not exists gols_linha2 text;
alter table favoritos_indice add column if not exists gols_prob2 int;

alter table favoritos_indice enable row level security;

-- Cada pessoa só vê os PRÓPRIOS favoritos (privado por conta — diferente
-- dos Jogos Agendados, que são compartilhados).
drop policy if exists "fi_select" on favoritos_indice;
create policy "fi_select" on favoritos_indice for select
  using (criado_por = auth.uid());

-- Qualquer pessoa aprovada pode favoritar (fica só na conta dela).
drop policy if exists "fi_insert" on favoritos_indice;
create policy "fi_insert" on favoritos_indice for insert
  with check (auth.uid() is not null and criado_por = auth.uid());

-- Só quem criou o favorito pode remover.
drop policy if exists "fi_delete" on favoritos_indice;
create policy "fi_delete" on favoritos_indice for delete
  using (criado_por = auth.uid());
