-- ═══════════════════════════════════════════════════
-- RATE LIMITING — auditoria de segurança, achado SEC-006
--
-- Tabela simples de controle: cada vez que uma function sensível (criar
-- pagamento, verificar pagamento) é chamada, registra uma linha aqui. Antes
-- de processar, a function conta quantas chamadas recentes existem pra
-- aquela mesma pessoa/chave — se passar do limite, recusa com "tente de novo
-- em instantes" em vez de processar.
--
-- Só as Netlify Functions mexem nessa tabela (usam a chave "service_role",
-- que ignora RLS) — por isso RLS fica ativado SEM NENHUMA policy: isso
-- bloqueia completamente qualquer acesso vindo do navegador (anon/authenticated),
-- de propósito. Só o backend consegue ler/escrever aqui.
-- ═══════════════════════════════════════════════════

create table if not exists rate_limit_chamadas (
  id bigint generated always as identity primary key,
  chave text not null,            -- ex: 'criar-assinatura:<uuid-do-usuario>'
  criado_em timestamptz default now()
);

create index if not exists idx_rate_limit_chave_tempo on rate_limit_chamadas(chave, criado_em);

alter table rate_limit_chamadas enable row level security;
-- Sem nenhuma policy = ninguém do frontend acessa, só service_role (backend).

-- Limpeza automática: apaga registros com mais de 1 dia toda vez que alguém
-- gravar uma linha nova, pra tabela não crescer pra sempre. Simples e
-- suficiente pro volume esperado — se um dia isso virar um app com milhões
-- de chamadas, vale trocar por um cron job de verdade (pg_cron).
create or replace function public.limpar_rate_limit_antigo()
returns trigger as $$
begin
  delete from rate_limit_chamadas where criado_em < now() - interval '1 day';
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_limpar_rate_limit on rate_limit_chamadas;
create trigger trg_limpar_rate_limit
  after insert on rate_limit_chamadas
  execute procedure public.limpar_rate_limit_antigo();
