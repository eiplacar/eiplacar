-- ═══════════════════════════════════════════════════
-- TABELA: banca
-- Usada pela Aba Banca — carteira INDIVIDUAL de cada pessoa (não é mais
-- um "pool" compartilhado entre todo mundo). Uma linha por usuário,
-- identificada por user_id; tudo o mais (saldo, entradas, movimentos,
-- proteção etc.) fica guardado como JSON em "dados".
-- ═══════════════════════════════════════════════════

create table if not exists banca (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade, -- 1 carteira por pessoa; "unique" é o que permite o upsert (?on_conflict=user_id) usado em 12-banca-futebol.js
  updated_at timestamptz default now(),
  dados jsonb
);

-- Se a tabela já existia da versão antiga (compartilhada, sem user_id — só
-- "id bigint primary key default 1"), esse bloco corrige sem apagar dados:
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'banca' and column_name = 'user_id') then
    alter table banca add column user_id uuid references auth.users(id) on delete cascade;
    alter table banca alter column id drop default; -- tira o "default 1" que travava todo insert novo na mesma linha
    alter table banca add constraint banca_user_id_key unique (user_id);
  end if;
end $$;
