-- ═══════════════════════════════════════════════════
-- TABELA: perfis
-- Controla login: papel de cada pessoa (organizador ou
-- membro) e status de aprovação.
-- ═══════════════════════════════════════════════════

create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  papel text default 'membro',      -- 'organizador' ou 'membro'
  status text default 'pendente',   -- 'pendente' ou 'aprovado'
  membro_id bigint,                 -- vincula ao participante correspondente na Banca
  created_at timestamptz default now()
);

-- ── GATILHO: cria o perfil automaticamente sempre que alguém se cadastra ──
-- A PRIMEIRA pessoa a se cadastrar vira organizador aprovado sozinho;
-- todo mundo depois disso entra como membro pendente, esperando aprovação
-- na Aba Banca.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome, papel, status)
  values (
    new.id,
    new.raw_user_meta_data->>'nome',
    case when (select count(*) from public.perfis) = 0 then 'organizador' else 'membro' end,
    case when (select count(*) from public.perfis) = 0 then 'aprovado' else 'pendente' end
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
