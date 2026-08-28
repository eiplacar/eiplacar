-- ═══════════════════════════════════════════════════
-- Corrige o cadastro não salvando telefone / data de nascimento / e-mail
-- no perfil da pessoa.
--
-- ANTES: o gatilho que cria a linha em "perfis" quando alguém se cadastra
-- (handle_new_user, em 04-tabela-perfis.sql) só gravava o nome. Telefone,
-- data de nascimento e e-mail dependiam de um PATCH separado feito pelo
-- app LOGO DEPOIS do cadastro (fazerCadastro, em public/js/01-config-auth.js)
-- — se esse PATCH falhasse por qualquer motivo (sessão ainda não pronta,
-- rede instável no exato momento, etc.) o dado digitado no cadastro se
-- perdia pra sempre, sem nenhum aviso.
--
-- AGORA: o gatilho grava telefone, data de nascimento e e-mail na mesma
-- transação que cria a conta — não depende mais de nenhuma chamada
-- separada do app pra isso funcionar. O PATCH que o app ainda faz depois
-- do cadastro passa a ser só um reforço, não mais o único caminho.
--
-- Rode este arquivo mesmo se já tiver rodado o 04 antes — ele só
-- substitui a função do gatilho (create or replace) e completa e-mail nas
-- contas que já existem e ainda estão com esse campo vazio.
-- ═══════════════════════════════════════════════════

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

-- Contas que já existiam antes dessa correção e ficaram com e-mail vazio
-- no perfil (telefone/nascimento dessas não tem como recuperar — só o
-- e-mail dá pra completar aqui, porque ele já existe em auth.users).
update public.perfis p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');
