-- ═══════════════════════════════════════════════════
-- TABELA: jogos_agendados ("Jogos Agendados" do Dashboard / Oportunidades)
-- Antes essa lista ficava em localStorage, uma cópia DIFERENTE por conta —
-- por isso jogo adicionado por um não aparecia pra outro. Agora é uma
-- tabela compartilhada: todo mundo vê os MESMOS jogos.
--
-- Regras (aplicadas aqui via RLS E também na tela, dos dois lados):
--   • Qualquer pessoa aprovada pode VER a lista.
--   • Só ORGANIZADOR pode ADICIONAR e APAGAR jogo.
--   • Qualquer pessoa aprovada pode EDITAR (a tela decide quais campos
--     aparecem editáveis pra quem não é organizador — Mercado/Minuto/
--     Odd/Situação; Campeonato/Times/Data/Horário só o organizador mexe).
--   • Não deixa cadastrar o MESMO jogo (mesmos times, mesma data) duas vezes.
-- Rode no SQL Editor do Supabase, de uma vez só.
-- ═══════════════════════════════════════════════════

create table if not exists jogos_agendados (
  id bigint generated always as identity primary key,
  camp text,
  casa text not null,
  vis text not null,
  data date not null,
  horario text,
  rodada text,
  mercado text,
  minuto text,
  odd text,
  status text default 'aguardando',
  criado_por uuid references auth.users(id),
  criado_em timestamptz default now()
);

-- Trava duplicidade: mesmo confronto (mandante+visitante), mesmo dia, não
-- pode ser cadastrado duas vezes (nem pelo mesmo organizador, nem por engano).
-- lower(trim(...)) ignora maiúscula/minúscula e espaço sobrando.
create unique index if not exists jogos_agendados_sem_duplicidade
  on jogos_agendados (data, lower(trim(casa)), lower(trim(vis)));

alter table jogos_agendados enable row level security;

-- Qualquer pessoa logada (aprovada, entra pelo app) vê a lista inteira.
drop policy if exists "ja_select" on jogos_agendados;
create policy "ja_select" on jogos_agendados for select
  using (auth.uid() is not null);

-- Só organizador adiciona.
drop policy if exists "ja_insert_organizador" on jogos_agendados;
create policy "ja_insert_organizador" on jogos_agendados for insert
  with check (exists (
    select 1 from perfis where perfis.id = auth.uid() and perfis.papel = 'organizador'
  ));

-- Só organizador apaga.
drop policy if exists "ja_delete_organizador" on jogos_agendados;
create policy "ja_delete_organizador" on jogos_agendados for delete
  using (exists (
    select 1 from perfis where perfis.id = auth.uid() and perfis.papel = 'organizador'
  ));

-- Qualquer pessoa logada pode editar (a TELA que restringe quais campos
-- ficam liberados pra quem não é organizador — mesmo padrão já usado no
-- resto do app pros botões "so-organizador").
drop policy if exists "ja_update" on jogos_agendados;
create policy "ja_update" on jogos_agendados for update
  using (auth.uid() is not null);
