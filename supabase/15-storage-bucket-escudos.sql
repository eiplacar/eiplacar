-- ═══════════════════════════════════════════════════
-- BUCKET DE STORAGE: escudos
-- ═══════════════════════════════════════════════════
-- Cria o bucket público "escudos" e as políticas de RLS na tabela
-- storage.objects que faltavam — sem elas, TODO upload pro Storage
-- (upload manual de escudo novo e o botão "Migrar Escudos") falha com
-- 400 Bad Request.
--
-- Por que 400 e não 403? O Storage do Supabase devolve 400 mesmo quando o
-- motivo real é a política de RLS bloqueando o INSERT/UPDATE (o corpo da
-- resposta traz "new row violates row-level security policy", só que com
-- status 400 em vez do 403 que a tabela "escudos" normal devolveria) — por
-- isso o console mostra só "400 (Bad Request)" pra CADA escudo, sem detalhe.
--
-- 05-seguranca-rls.sql já protege a TABELA "escudos" (a URL salva), mas
-- nunca existiu no projeto nenhuma política pro BUCKET (o arquivo .png em
-- si) — são duas coisas separadas no Supabase. Este arquivo recria a função
-- is_organizador() de novo aqui embaixo (é seguro rodar de novo, mesmo que
-- 05 já tenha rodado antes), então funciona mesmo sozinho — só precisa que
-- a tabela "perfis" já exista (04-tabela-perfis.sql).
-- ═══════════════════════════════════════════════════

-- Cria o bucket "escudos" como público, se ainda não existir (se você já
-- criou pelo painel, esse "on conflict" só garante que ele fica público).
insert into storage.buckets (id, name, public)
values ('escudos', 'escudos', true)
on conflict (id) do update set public = true;

-- Garante que a função exista aqui também (não depende do 05 ter rodado
-- antes nesse mesmo projeto/banco — se já existir, isso só recria igual).
-- Precisa ser "security definer" pra não cair no loop de recursão descrito
-- em 05-seguranca-rls.sql.
create or replace function public.is_organizador()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from perfis where id = auth.uid() and papel = 'organizador'
  );
$$;

drop policy if exists "escudos_storage_select" on storage.objects;
drop policy if exists "escudos_storage_insert_organizador" on storage.objects;
drop policy if exists "escudos_storage_update_organizador" on storage.objects;

-- Leitura pública dos arquivos (necessário pra <img src="..."> funcionar pra
-- qualquer visitante, mesmo sem login) — a flag "public" do bucket sozinha
-- não basta, o Storage também confere RLS em storage.objects.
create policy "escudos_storage_select" on storage.objects
  for select to public
  using (bucket_id = 'escudos');

-- Só organizador pode subir escudo novo — mesmo critério já usado na tabela
-- "escudos" (05-seguranca-rls.sql, achado SEC-002), agora espelhado aqui.
-- Função chamada com o schema explícito (public.is_organizador) pra não
-- depender do search_path da sessão que roda esse SQL.
create policy "escudos_storage_insert_organizador" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'escudos' and public.is_organizador());

-- Só organizador pode trocar um escudo existente — necessário porque o
-- upload usa upsert:true (05-escudos.js), que faz UPDATE quando o arquivo
-- (mesmo nome/slug) já existe no bucket.
create policy "escudos_storage_update_organizador" on storage.objects
  for update to authenticated
  using (bucket_id = 'escudos' and public.is_organizador())
  with check (bucket_id = 'escudos' and public.is_organizador());
