// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — recebe as notificações (webhook) do Mercado Pago
// quando um pagamento único (Pix avulso ou cartão/outro meio via Checkout
// Pro) é aprovado, e atualiza o Supabase automaticamente — mesma coisa que
// o organizador hoje faz na mão em Administração → Usuários
// (adminAprovarPlano / adminRenovarPlano). Não existe mais assinatura
// recorrente nesse app: todo pagamento é único, e quando o período acaba a
// pessoa decide se quer voltar e pagar de novo.
//
// Configurar essa URL como webhook no painel do Mercado Pago:
//   Suas integrações → aplicação → Webhooks → URL de produção:
//   https://SEU-SITE.netlify.app/.netlify/functions/webhook-mercadopago
//   Evento: marcar "Pagamentos (legacy)" (formato IPN, parâmetros na URL) OU
//   "Pagamentos"/"payment" (formato novo, JSON no corpo) — o código abaixo
//   lê os dois formatos, então qualquer um dos dois funciona. Os eventos de
//   "Assinaturas" (subscription_preapproval e subscription_authorized_payment)
//   só importam se ainda sobrar alguma assinatura recorrente antiga ativa
//   (ver comentário mais abaixo).
//   IMPORTANTE: mesmo que o evento "Pagamentos" não esteja marcado no
//   painel, todo pagamento único (Pix ou cartão) também é liberado na hora
//   por verificar-pagamento-pix.js, chamado pela própria tela do app
//   enquanto espera a confirmação — esse webhook deixou de ser o único
//   caminho, é só um reforço para quando a pessoa fecha o app antes disso.
//
// IMPORTANTE: nunca confia no corpo da notificação sozinho (qualquer um pode
// chamar essa URL forjando um payload) — sempre busca o dado de verdade na
// API do Mercado Pago usando o ID recebido, com o Access Token.
//
// Variáveis de ambiente necessárias (painel da Netlify):
//   MP_ACCESS_TOKEN       → Access Token do Mercado Pago (teste ou produção)
//   SUPABASE_URL          → mesma URL do public/js/01-config-auth.js
//   SUPABASE_SERVICE_KEY  → chave "service_role" do Supabase (Settings → API)
//                            precisa dela pra poder escrever no perfil de
//                            qualquer usuário, sem estar logado como ele.
// ═══════════════════════════════════════════════════

// Mesmo mapeamento de dias por plano usado em criar-assinatura.js e na
// aprovação manual (Administração → Usuários) — precisa ficar sempre igual
// nos 3 lugares, senão o mesmo plano "trimestral" renova por prazos diferentes
// dependendo de quem/o que processou.
const DIAS_POR_FREQUENCIA = {
  '1-months': 30,   // mensal
  '3-months': 90,   // trimestral
  '6-months': 180,  // semestral
};
const PLANO_POR_FREQUENCIA = {
  '1-months': 'mensal',
  '3-months': 'trimestral',
  '6-months': 'semestral',
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) };
}

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
function somarDias(dataBase, dias) {
  const d = new Date(dataBase + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

async function mpFetch(path, mpToken) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Ativa/renova o plano do usuário no Supabase — mesma lógica de
// adminAprovarPlano/adminRenovarPlano (16-admin.js): renova a partir do
// vencimento atual se ele ainda não passou, ou de hoje se já passou.
//
// pixPaymentId: só é passado pro Pix avulso (não pra assinatura recorrente).
// Esse mesmo pagamento pode chegar aqui por dois caminhos — o webhook do
// Mercado Pago E o polling da tela de "aguardando confirmação" no app
// (verificar-pagamento-pix.js), quase ao mesmo tempo. Por isso, antes de
// creditar, checa se esse paymentId já foi creditado antes; se sim, não
// soma os 30 dias de novo.
async function liberarAssinatura({ supaUrl, supaServiceKey, userId, dias, mpId, plano, pixPaymentId }) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: supaServiceKey,
    Authorization: `Bearer ${supaServiceKey}`,
    Prefer: 'return=representation',
  };
  const base = supaUrl.replace(/\/$/, '');

  const resAtual = await fetch(`${base}/rest/v1/perfis?id=eq.${userId}&select=assinatura_vencimento,assinatura_pix_pagamento_id`, { headers });
  const atual = resAtual.ok ? await resAtual.json() : [];
  const perfil = atual?.[0] || {};

  if (pixPaymentId && perfil.assinatura_pix_pagamento_id === String(pixPaymentId)) {
    return true; // esse pagamento Pix já foi creditado (webhook ou polling chegou primeiro) — não credita de novo
  }

  const vencAtual = perfil.assinatura_vencimento;
  const hoje = hojeSaoPaulo();
  const dataBase = (vencAtual && vencAtual >= hoje) ? vencAtual : hoje;

  const corpo = { assinatura_status: 'ativo', assinatura_vencimento: somarDias(dataBase, dias), assinatura_cancelada: false };
  if (mpId) corpo.assinatura_mp_id = mpId; // só grava/atualiza quando vem de uma assinatura recorrente (não no Pix avulso)
  if (plano) corpo.plano = plano; // faltava isso — sem gravar, a tela continuava mostrando "Teste Gratuito" mesmo após pagar
  if (pixPaymentId) corpo.assinatura_pix_pagamento_id = String(pixPaymentId);

  const resUpdate = await fetch(`${base}/rest/v1/perfis?id=eq.${userId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(corpo),
  });
  return resUpdate.ok;
}

export const handler = async function (event) {
  if (event.httpMethod !== 'POST') return resposta(405);

  const mpToken = process.env.MP_ACCESS_TOKEN;
  const supaUrl = process.env.SUPABASE_URL;
  const supaServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!mpToken || !supaUrl || !supaServiceKey) {
    console.log('ERRO: faltam variáveis de ambiente', { temMpToken: !!mpToken, temSupaUrl: !!supaUrl, temSupaServiceKey: !!supaServiceKey });
    return resposta(500);
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; } // corpo vazio/inválido não pode derrubar a function — o formato "legacy" abaixo não depende dele
  // O tipo do evento pode vir de duas formas diferentes, dependendo de qual
  // opção foi marcada no painel do Mercado Pago (Webhooks → Suas integrações):
  //   • Formato novo (JSON no corpo): { "type": "payment", "data": { "id": "..." } }
  //   • Formato "Pagamentos (legacy)" / IPN (parâmetros na URL, corpo vazio):
  //     POST .../webhook-mercadopago?topic=payment&id=123456789
  // Sem checar os dois, uma notificação "legacy" chega mas não é reconhecida
  // — o código cai direto no "ignora" do final e nada é atualizado, mesmo com
  // o webhook certinho configurado no painel.
  const tipo = payload.type || payload.topic || event.queryStringParameters?.type || event.queryStringParameters?.topic;
  const id = payload.data?.id || payload['data.id'] || event.queryStringParameters?.id || event.queryStringParameters?.['data.id'];
  console.log('Webhook Mercado Pago recebido:', { tipo, id });
  if (!id) return resposta(200); // notificação sem id útil — confirma recebido e ignora

  try {
    // ── LEGADO: assinatura recorrente (preapproval) ──
    // O app não cria mais assinaturas recorrentes (criar-assinatura.js agora
    // gera pagamento único via Checkout Pro — ver comentário no topo desse
    // arquivo). Esses dois blocos ficam aqui só pra quem ainda tem uma
    // assinatura antiga rodando (criada antes dessa mudança): o Mercado Pago
    // continua mandando os eventos dela até a pessoa cancelar (Administração
    // → Usuários, ou tela "Seja Assinante" → "Cancelar assinatura recorrente")
    // ou ela mesma acabar. Pode remover esses dois blocos com segurança assim
    // que não sobrar nenhuma assinatura antiga ativa.
    if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
      const { ok, data } = await mpFetch(`/preapproval/${id}`, mpToken);
      if (!ok) { console.log('Preapproval não encontrado na API do MP:', id); return resposta(200); }
      console.log('Preapproval consultado:', { id, status: data.status, external_reference: data.external_reference });

      if (data.status === 'authorized') {
        const chave = `${data.auto_recurring?.frequency}-${data.auto_recurring?.frequency_type}`;
        const dias = DIAS_POR_FREQUENCIA[chave] || 30;
        const plano = PLANO_POR_FREQUENCIA[chave] || 'mensal';
        const ok2 = await liberarAssinatura({ supaUrl, supaServiceKey, userId: data.external_reference, dias, mpId: id, plano });
        console.log('Assinatura liberada:', { userId: data.external_reference, dias, plano, ok: ok2 });
      }
      return resposta(200);
    }

    // ── LEGADO: cobrança recorrente de uma assinatura antiga ──
    if (tipo === 'subscription_authorized_payment') {
      const { ok, data } = await mpFetch(`/authorized_payments/${id}`, mpToken);
      if (!ok) { console.log('Authorized payment não encontrado na API do MP:', id); return resposta(200); }
      console.log('Cobrança recorrente consultada:', { id, status: data.status, preapproval_id: data.preapproval_id });

      if (data.status === 'approved' && data.preapproval_id) {
        const { ok: okPre, data: preapproval } = await mpFetch(`/preapproval/${data.preapproval_id}`, mpToken);
        if (okPre && preapproval.external_reference) {
          const chave = `${preapproval.auto_recurring?.frequency}-${preapproval.auto_recurring?.frequency_type}`;
          const dias = DIAS_POR_FREQUENCIA[chave] || 30;
          const plano = PLANO_POR_FREQUENCIA[chave] || 'mensal';
          const ok2 = await liberarAssinatura({ supaUrl, supaServiceKey, userId: preapproval.external_reference, dias, plano });
          console.log('Assinatura renovada:', { userId: preapproval.external_reference, dias, plano, ok: ok2 });
        }
      }
      return resposta(200);
    }

    // ── Pagamento único via Checkout Pro (cartão, Pix, boleto — tudo
    // gerado por criar-assinatura.js) ── Não é recorrente: cada pagamento
    // aprovado aqui libera um período fixo de acesso e não agenda cobrança
    // nenhuma pro futuro.
    if (tipo === 'payment') {
      const { ok, data } = await mpFetch(`/v1/payments/${id}`, mpToken);
      if (!ok) { console.log('Pagamento não encontrado na API do MP:', id); return resposta(200); }
      console.log('Pagamento avulso consultado:', { id, status: data.status, payment_method_id: data.payment_method_id, external_reference: data.external_reference, metadata: data.metadata });

      if (data.status === 'approved' && data.external_reference) {
        // dias/plano vêm do metadata gravado na hora de criar o pagamento
        // (criar-assinatura.js grava plano_id/dias). Pagamento antigo, de
        // antes dessa mudança e sem metadata, cai no padrão de 30 dias /
        // mensal (era a única opção que existia até aqui).
        const dias = Number(data.metadata?.dias) || 30;
        const plano = data.metadata?.plano_id || 'mensal';
        const ok2 = await liberarAssinatura({ supaUrl, supaServiceKey, userId: data.external_reference, dias, plano, pixPaymentId: id });
        console.log('Pagamento único liberou acesso:', { userId: data.external_reference, dias, plano, meio: data.payment_method_id, ok: ok2 });
      }
      return resposta(200);
    }

    // outros tipos de evento — ignora
    return resposta(200);
  } catch (e) {
    console.log('Erro processando webhook:', e.message);
    return resposta(200); // sempre 200 pro Mercado Pago não ficar retentando pra sempre
  }
};
