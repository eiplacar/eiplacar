# Setup do Supabase — Ei Placar

Este app usa Supabase (Postgres + Auth) pra sincronizar dados na nuvem. As
credenciais já vêm fixas no código (`public/js/01-config-auth.js`, constantes
`SUPA_URL`/`SUPA_KEY`) — não existe mais tela dentro do app pra configurar
isso; esse guia é só pra referência de quem for criar/manter o banco.

## 1. Criar o projeto
1. Acesse [supabase.com](https://supabase.com) → crie uma conta gratuita
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute:

```sql
create table jogos (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  camp text, data text, rodada text,
  local text, casa text, vis text,
  "gC" int, "gV" int,
  "rankC" int, "rankV" int,
  gols jsonb,
  "golsHT_C" int, "golsHT_V" int,
  "chutesC" int, "chutesV" int,
  "chutesGolC" int, "chutesGolV" int,
  "escanteiosC" int, "escanteiosV" int,
  "amarelosC" int, "amarelosV" int,
  "vermelhosC" int, "vermelhosV" int
);

create table banca (
  id bigint primary key default 1,
  updated_at timestamptz default now(),
  dados jsonb
);

create table escudos (
  id bigint primary key default 1,
  updated_at timestamptz default now(),
  dados jsonb
);
```

4. Vá em **Settings → API** e copie a **URL** e a chave **anon public** —
   cole em `SUPA_URL`/`SUPA_KEY` no topo de `public/js/01-config-auth.js`.
5. A aba **Banca** (carteira, depósitos/retiradas, entradas) usa a tabela
   `banca` acima para sincronizar entre dispositivos.
6. A tabela `escudos` guarda os escudos dos times enviados pelo usuário, pra
   não sumirem quando o app for atualizado.

## 2. Já tem o banco criado e está dando erro ao salvar/importar?
A tabela está faltando colunas novas — rode isto no SQL Editor (não apaga
nada):

```sql
alter table jogos
  add column if not exists "golsHT_C" int,
  add column if not exists "golsHT_V" int,
  add column if not exists "chutesC" int,
  add column if not exists "chutesV" int,
  add column if not exists "chutesGolC" int,
  add column if not exists "chutesGolV" int,
  add column if not exists "escanteiosC" int,
  add column if not exists "escanteiosV" int,
  add column if not exists "amarelosC" int,
  add column if not exists "amarelosV" int,
  add column if not exists "vermelhosC" int,
  add column if not exists "vermelhosV" int;
```

## 3. Tabela `perfis` (login/aprovação de membros)
Usada pelo fluxo de autenticação (`public/js/01-config-auth.js`). Colunas
mínimas: `id`, `nome`, `papel` (`organizador`|`membro`), `status`
(`pendente`|`aprovado`|`rejeitado`), `membro_id`, `created_at`.

Colunas extras usadas pela aba **Conta → Perfil** e pelo painel
**Administração → Usuários** (opcionais — se não existirem, as telas
simplesmente não mostram/editam esses campos):

```sql
alter table perfis
  add column if not exists telefone text,
  add column if not exists data_nascimento date,
  add column if not exists foto_url text,
  add column if not exists email text,
  add column if not exists bloqueado boolean default false,
  add column if not exists plano text,
  add column if not exists assinatura_status text default 'trial',
  add column if not exists assinatura_inicio date,
  add column if not exists assinatura_vencimento date;
```

`email` não vem preenchido sozinho (o app só enxerga o e-mail de quem está
logado, não o dos outros usuários) — se quiser que o painel de Administração
mostre o e-mail de cada usuário, preencha essa coluna via trigger no
cadastro, ou copie manualmente.

`created_at` normalmente já existe por padrão em tabelas novas do Supabase
(`timestamptz default now()`); se a sua não tiver, `add column if not exists
created_at timestamptz default now()`.

## 4. Tabela `config_app` (Administração → Sistema)
Guarda o preço dos planos e os dias de teste grátis — configurável pelo
organizador em **Administração → Sistema**.

```sql
create table config_app (
  id bigint primary key default 1,
  updated_at timestamptz default now(),
  dados jsonb
);
```

