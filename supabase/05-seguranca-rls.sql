-- ═══════════════════════════════════════════════════
-- SEGURANÇA (RLS)
-- Só quem estiver logado consegue ler/escrever.
-- Visitante de fora (sem login) não acessa nada, mesmo
-- sabendo a URL do site.
--
-- Rode este arquivo por ÚLTIMO, depois de já ter
-- criado as 4 tabelas (01 a 04).
--
-- Esse arquivo pode ser rodado quantas vezes você quiser,
-- não importa o que já exista no banco — ele sempre apaga
-- a política antiga (se houver) antes de criar de novo,
-- então nunca dá erro de "already exists".
-- ═══════════════════════════════════════════════════

alter table jogos   enable row level security;
alter table banca   enable row level security;
alter table escudos enable row level security;
alter table perfis  enable row level security;

drop policy if exists "logado le/escreve jogos" on jogos;
create policy "logado le/escreve jogos" on jogos for all to authenticated using (true) with check (true);

drop policy if exists "logado le/escreve banca" on banca;
create policy "logado le/escreve banca" on banca for all to authenticated using (true) with check (true);

drop policy if exists "logado le/escreve escudos" on escudos;
create policy "logado le/escreve escudos" on escudos for all to authenticated using (true) with check (true);

drop policy if exists "logado ve todos os perfis" on perfis;
create policy "logado ve todos os perfis" on perfis for select to authenticated using (true);

-- Só organizador pode aprovar/editar o perfil de outra pessoa
drop policy if exists "organizador edita perfis" on perfis;
create policy "organizador edita perfis" on perfis for update to authenticated using (
  exists (select 1 from perfis p where p.id = auth.uid() and p.papel = 'organizador')
);
