-- ═══════════════════════════════════════════════════
-- TABELA: perfis
-- Controla login: papel de cada pessoa (organizador ou
-- membro) e status de aprovação.
-- ═══════════════════════════════════════════════════

create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  papel text default 'membro',      -- 'organizador' ou 'membro'
  status text default 'aprovado',   -- aprovação manual de cadastro removida; sempre 'aprovado'
  membro_id bigint,                 -- vincula ao participante correspondente na Banca
  created_at timestamptz default now()
);

-- ── GATILHO: cria o perfil automaticamente sempre que alguém se cadastra ──
-- A PRIMEIRA pessoa a se cadastrar vira organizador; todo mundo depois disso
-- entra como membro. Aprovação manual removida: todo mundo já entra "aprovado".
-- Telefone, data de nascimento e e-mail são gravados aqui na mesma transação
-- que cria a conta (a pessoa preenche esses campos na tela de cadastro) — não
-- dependem de nenhuma chamada separada do app pra funcionar.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome, papel, status, telefone, data_nascimento, email)
  values (
    new.id,
    new.raw_user_meta_data->>'nome',
    case when (select count(*) from public.perfis) = 0 then 'organizador' else 'membro' end,
    'aprovado',
    new.raw_user_meta_data->>'telefone',
    nullif(new.raw_user_meta_data->>'data_nascimento', '')::date,
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Colunas extras usadas por Conta → Perfil, Administração → Usuários e
-- pelos pagamentos (Mercado Pago) — todas num só lugar, pra não ter que
-- caçar em arquivos separados quais colunas a tabela perfis precisa ──
alter table perfis
  add column if not exists telefone text,
  add column if not exists data_nascimento date,
  add column if not exists foto_url text,
  add column if not exists email text,
  add column if not exists bloqueado boolean default false,
  add column if not exists plano text,
  add column if not exists assinatura_status text default 'trial',
  add column if not exists assinatura_inicio date,
  add column if not exists assinatura_vencimento date,
  add column if not exists assinatura_mp_id text,          -- id da assinatura (preapproval) no Mercado Pago, só usado por assinaturas recorrentes antigas — pagamento novo é sempre único e não preenche essa coluna
  add column if not exists assinatura_cancelada boolean default false, -- true = não cobra mais, mas mantém acesso até assinatura_vencimento (só relevante pras assinaturas recorrentes antigas)
  add column if not exists assinatura_pix_pagamento_id text, -- id do último pagamento único (Pix ou cartão via Checkout Pro) já creditado, pra não liberar o mesmo pagamento
                                                               -- duas vezes (a verificação da tela do app e o webhook do Mercado Pago podem chegar quase juntos)
  add column if not exists termos_aceitos_em timestamptz;    -- data/hora em que a pessoa aceitou os Termos de Uso e a Política de Privacidade no cadastro (comprovante)

-- Contas que já existiam antes do gatilho gravar e-mail (linhas antigas com
-- email vazio no perfil) — completa a partir de auth.users, que sempre tem
-- o e-mail de verdade. Telefone/nascimento de contas antigas não tem como
-- recuperar (nunca foram digitados em lugar nenhum antes dessa versão).
update public.perfis p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');
