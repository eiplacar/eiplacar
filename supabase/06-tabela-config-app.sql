-- ═══════════════════════════════════════════════════
-- TABELA: config_app
-- Guarda o preço dos planos e os dias de teste grátis —
-- configurável pelo organizador em Administração → Sistema.
-- ═══════════════════════════════════════════════════

create table if not exists config_app (
  id bigint primary key default 1,
  updated_at timestamptz default now(),
  dados jsonb
);

alter table config_app enable row level security;

-- Qualquer pessoa logada pode ler (precisa pra tela funcionar pra todo mundo)
drop policy if exists "logado le config_app" on config_app;
create policy "logado le config_app" on config_app for select to authenticated using (true);

-- Só organizador pode alterar os preços/config do sistema
drop policy if exists "organizador escreve config_app" on config_app;
create policy "organizador escreve config_app" on config_app for all to authenticated using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.papel = 'organizador')
) with check (
  exists (select 1 from perfis p where p.id = auth.uid() and p.papel = 'organizador')
);
