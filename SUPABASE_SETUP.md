# Setup do Supabase — Ei Placar

Este app usa Supabase (Postgres + Auth) pra sincronizar dados na nuvem. As
credenciais já vêm fixas no código (`public/js/01-config-auth.js`, constantes
`SUPA_URL`/`SUPA_KEY`) — não existe mais tela dentro do app pra configurar
isso; esse guia é só pra referência de quem for criar/manter o banco.

## Projeto atual

- **URL:** `https://bwddsdggadlhusntbbrb.supabase.co`
- As tabelas desse projeto são criadas/mantidas pelos scripts numerados na
  pasta `supabase/` (veja `supabase/00-LEIA-ME.txt` pra ordem de execução) —
  esse é o **único lugar** com o schema completo e atualizado. Este arquivo
  não duplica mais o SQL, pra evitar os dois ficarem desalinhados.

## 1. Criar um projeto novo do zero (se precisar trocar de conta de novo)

1. Acesse [supabase.com](https://supabase.com) → crie uma conta gratuita
2. Crie um novo projeto
3. Vá em **SQL Editor** e rode, um de cada vez e NESSA ORDEM, todos os
   arquivos da pasta `supabase/` do projeto (01 a 06) — eles usam
   `create table if not exists` e `drop ... if exists`, então são seguros
   de rodar mesmo em bancos já existentes
4. Vá em **Settings → API** e copie a **URL** e a chave (**anon public** ou
   **publishable**, dependendo da versão do painel) — cole em
   `SUPA_URL`/`SUPA_KEY` no topo de `public/js/01-config-auth.js`
5. A aba **Banca** (carteira, depósitos/retiradas, entradas) usa a tabela
   `banca` pra sincronizar entre dispositivos
6. A tabela `escudos` guarda os escudos dos times enviados pelo usuário, pra
   não sumirem quando o app for atualizado
7. A tabela `config_app` guarda o preço dos planos e dias de teste grátis,
   editável em **Administração → Sistema**

## 2. Já tem o banco criado e está dando erro ao salvar/importar?

Rode de novo os arquivos da pasta `supabase/`, na ordem — eles não apagam
nada que já existe, só criam o que estiver faltando (colunas novas, tabelas
novas, políticas de segurança).

## 3. Tabela `perfis` (login/aprovação de membros)

Usada pelo fluxo de autenticação (`public/js/01-config-auth.js`). Colunas
mínimas: `id`, `nome`, `papel` (`organizador`|`membro`), `status`
(`pendente`|`aprovado`|`rejeitado`), `membro_id`, `created_at`. As colunas
extras (telefone, foto, plano, assinatura etc.) usadas pela aba **Conta →
Perfil** e pelo painel **Administração → Usuários** já vêm no arquivo
`supabase/04-tabela-perfis.sql`.

`email` não vem preenchido sozinho (o app só enxerga o e-mail de quem está
logado, não o dos outros usuários) — se quiser que o painel de Administração
mostre o e-mail de cada usuário, preencha essa coluna via trigger no
cadastro, ou copie manualmente.
