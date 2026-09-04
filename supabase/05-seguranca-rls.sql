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

-- ── FUNÇÃO AUXILIAR: "quem está logado é organizador?" ──
-- IMPORTANTE: essa função existe pra evitar um bug clássico do Postgres —
-- "infinite recursion detected in policy for relation perfis". Se a política
-- de SELECT de "perfis" tentasse consultar a própria tabela "perfis" direto
-- (`exists (select 1 from perfis where ...)`), isso dispararia a MESMA
-- política de novo pra avaliar essa subconsulta, que dispara de novo, num
-- loop infinito — e todo mundo (inclusive o login) parava de funcionar.
-- Uma função "security definer" quebra esse loop: ela consulta a tabela
-- ignorando a RLS (com a permissão de quem criou a função), então não
-- reaciona a política. Use SEMPRE essa função em vez de escrever
-- "exists (select ... from perfis ...)" direto dentro de uma policy.
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

-- Jogos (dados oficiais de partidas): qualquer pessoa logada pode VER, mas só
-- organizador pode inserir/editar/apagar. Antes disso, qualquer membro comum
-- conseguia alterar resultados, gols, cartões — dados que TODO MUNDO usa nas
-- telas de Classificação/Análise/Estatística. Auditoria de segurança, achado SEC-003.
drop policy if exists "logado le/escreve jogos" on jogos;
drop policy if exists "jogos_select" on jogos;
drop policy if exists "jogos_insert_organizador" on jogos;
drop policy if exists "jogos_update_organizador" on jogos;
drop policy if exists "jogos_delete_organizador" on jogos;
create policy "jogos_select" on jogos for select to authenticated using (true);
create policy "jogos_insert_organizador" on jogos for insert to authenticated with check (is_organizador());
create policy "jogos_update_organizador" on jogos for update to authenticated using (is_organizador());
create policy "jogos_delete_organizador" on jogos for delete to authenticated using (is_organizador());

-- A Banca é uma carteira INDIVIDUAL (ver 02-tabela-banca.sql) — cada pessoa
-- só pode ler/escrever a PRÓPRIA linha (user_id = quem está logado), nunca a
-- de outra pessoa. Antes disso qualquer pessoa logada conseguia ler/editar a
-- banca de qualquer outra pessoa direto pela API, mesmo sem aparecer no app.
drop policy if exists "logado le/escreve banca" on banca;
drop policy if exists "cada um le/escreve so a propria banca" on banca;
create policy "cada um le/escreve so a propria banca" on banca for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Escudos: qualquer pessoa logada pode VER, mas só o organizador pode
-- adicionar/trocar. Antes disso, qualquer membro comum conseguia sobrescrever
-- os escudos de TODO MUNDO direto pela API (sem passar pela tela de upload),
-- o que também fechava uma porta de injeção de HTML malicioso (o valor salvo
-- vira `<img src="...">` na hora de mostrar — ver escudoImgOuIcone em
-- public/js/05-escudos.js). Auditoria de segurança, achado SEC-002.
drop policy if exists "logado le/escreve escudos" on escudos;
drop policy if exists "escudos_select" on escudos;
drop policy if exists "escudos_insert_organizador" on escudos;
drop policy if exists "escudos_update_organizador" on escudos;
create policy "escudos_select" on escudos for select to authenticated using (true);
create policy "escudos_insert_organizador" on escudos for insert to authenticated with check (is_organizador());
create policy "escudos_update_organizador" on escudos for update to authenticated using (is_organizador());

-- Cada pessoa vê o PRÓPRIO perfil completo; só organizador vê o perfil de
-- todo mundo (precisa disso pra Administração → Usuários funcionar). Antes,
-- "using (true)" deixava QUALQUER pessoa logada consultar telefone, data de
-- nascimento, e-mail e status de assinatura de TODO MUNDO — bastava um GET
-- direto na API, sem passar pelo app. Auditoria de segurança, achado SEC-004.
drop policy if exists "logado ve todos os perfis" on perfis;
drop policy if exists "perfis_select" on perfis;
create policy "perfis_select" on perfis for select to authenticated using (
  id = auth.uid() or is_organizador()
);

-- Só organizador pode aprovar/editar o perfil de outra pessoa
drop policy if exists "organizador edita perfis" on perfis;
create policy "organizador edita perfis" on perfis for update to authenticated using (is_organizador());

-- Qualquer pessoa logada pode editar o PRÓPRIO perfil (nome, telefone, foto etc.)
drop policy if exists "cada um edita o proprio perfil" on perfis;
create policy "cada um edita o proprio perfil" on perfis for update to authenticated using (
  id = auth.uid()
) with check (
  id = auth.uid()
);

-- Faltava policy de DELETE em "perfis" — sem nenhuma, o Postgres nega por
-- padrão pra TODO MUNDO (inclusive organizador), então o botão "Excluir
-- usuário" da Administração já devia estar falhando silenciosamente. Só
-- organizador pode excluir, e nunca a própria conta (evita se auto-excluir
-- sem querer e ficar sem nenhum organizador no sistema).
drop policy if exists "organizador exclui perfis" on perfis;
create policy "organizador exclui perfis" on perfis for delete to authenticated using (
  id <> auth.uid() and is_organizador()
);

-- ── PROTEÇÃO DE COLUNAS ADMINISTRATIVAS (auditoria de segurança, achado SEC-001) ──
-- A policy "cada um edita o proprio perfil" acima libera a pessoa editar a
-- PRÓPRIA linha inteira — mas RLS do Postgres só controla LINHA, não COLUNA.
-- Sem essa trava, qualquer pessoa logada conseguia mandar um PATCH direto pra
-- API (sem passar pelo app) e virar organizador, liberar a própria assinatura
-- sem pagar, ou se desbloquear sozinha depois de bloqueada. Esse gatilho
-- reverte esses campos pro valor antigo sempre que quem está editando NÃO é
-- organizador — a pessoa continua podendo editar nome/telefone/data de
-- nascimento/foto/e-mail normalmente, só os campos administrativos ficam
-- travados. (Função em si já é "security definer", então a consulta interna
-- não reaciona a RLS/policy de "perfis" — não tem risco de recursão aqui.)
create or replace function public.protege_colunas_administrativas()
returns trigger as $$
begin
  if not is_organizador() then
    new.papel := old.papel;
    new.status := old.status;
    new.bloqueado := old.bloqueado;
    new.plano := old.plano;
    new.assinatura_status := old.assinatura_status;
    new.assinatura_inicio := old.assinatura_inicio;
    new.assinatura_vencimento := old.assinatura_vencimento;
    new.assinatura_mp_id := old.assinatura_mp_id;
    new.assinatura_cancelada := old.assinatura_cancelada;
    new.assinatura_pix_pagamento_id := old.assinatura_pix_pagamento_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_protege_colunas_admin on perfis;
create trigger trg_protege_colunas_admin
  before update on perfis
  for each row execute procedure public.protege_colunas_administrativas();

