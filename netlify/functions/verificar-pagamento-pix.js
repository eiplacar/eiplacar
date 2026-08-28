// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — consulta o status de um pagamento Pix específico
// direto na API do Mercado Pago, pelo paymentId devolvido por
// criar-pagamento-pix.js, e — se estiver aprovado — já libera o mês de
// acesso na hora, sem depender do webhook do Mercado Pago ter sido
// entregue (o Pix avulso é um evento de "Pagamentos", separado do de
// "Assinaturas", e fica sem efeito se esse tópico não estiver marcado
// no painel do Mercado Pago — ver webhook-mercadopago.js).
//
// Chamada pelo app em: POST /.netlify/functions/verificar-pagamento-pix
//   body: { "paymentId": "123456789" }
//   header: Authorization: Bearer <token da sessão Supabase do usuário>
// Devolve: { status: "approved" | "pending" | "rejected" | ... }
//
// Variáveis de ambiente necessárias (painel da Netlify):
//   MP_ACCESS_TOKEN       → Access Token do Mercado Pago (teste ou produção)
//   SUPABASE_URL          → mesma URL do public/js/01-config-auth.js
//   SUPABASE_ANON_KEY     → chave "anon" do Supabase, só pra validar sessão
//   SUPABASE_SERVICE_KEY  → chave "service_role" do Supabase (Settings → API),
//                            precisa dela pra poder escrever no perfil de
//                            quem pagou (pode não ser quem chamou essa função).
// ═══════════════════════════════════════════════════

function resposta(statusCode, corpo) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) };
}

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
function somarDias(dataBase, dias) {
  const d = new Date(dataBase + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

// Mesma lógica de liberarAssinatura do webhook-mercadopago.js (duplicada de
// propósito — cada function do Netlify aqui é autocontida). Trava por
// pixPaymentId pra não creditar duas vezes o mesmo pagamento caso o
// webhook chegue também, quase ao mesmo tempo.
async function liberarAssinatura({ supaUrl, supaServiceKey, userId, dias, plano, pixPaymentId }) {
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
    return true; // já creditado (pelo webhook ou por uma chamada anterior desse polling)
  }

  const vencAtual = perfil.assinatura_vencimento;
  const hoje = hojeSaoPaulo();
  const dataBase = (vencAtual && vencAtual >= hoje) ? vencAtual : hoje;

  const corpo = {
    assinatura_status: 'ativo',
    assinatura_vencimento: somarDias(dataBase, dias),
    assinatura_cancelada: false,
    plano,
    assinatura_pix_pagamento_id: String(pixPaymentId),
  };

  const resUpdate = await fetch(`${base}/rest/v1/perfis?id=eq.${userId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(corpo),
  });
  return resUpdate.ok;
}

export const handler = async function (event) {
  if (event.httpMethod !== 'POST') return resposta(405, { erro: 'Método não permitido' });

  const mpToken = process.env.MP_ACCESS_TOKEN;
  const supaUrl = process.env.SUPABASE_URL;
  const supaAnonKey = process.env.SUPABASE_ANON_KEY;
  const supaServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!mpToken || !supaUrl || !supaAnonKey || !supaServiceKey) {
    console.log('ERRO: faltam variáveis de ambiente', { temMpToken: !!mpToken, temSupaUrl: !!supaUrl, temSupaAnonKey: !!supaAnonKey, temSupaServiceKey: !!supaServiceKey });
    return resposta(500, { erro: 'Faltam variáveis de ambiente' });
  }

  let paymentId;
  try { paymentId = JSON.parse(event.body || '{}').paymentId; } catch { return resposta(400, { erro: 'Corpo inválido' }); }
  if (!paymentId) return resposta(400, { erro: 'paymentId é obrigatório' });

  // Só confirma quem está logado (não precisa ser dono do pagamento — o
  // acesso liberado é sempre o do external_reference gravado no pagamento
  // lá no Mercado Pago, nunca o de quem chamou essa função).
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer /i, '');
  if (!token) return resposta(401, { erro: 'Não autenticado' });
  const resUser = await fetch(`${supaUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: supaAnonKey, Authorization: `Bearer ${token}` },
  });
  if (!resUser.ok) return resposta(401, { erro: 'Sessão inválida' });

  try {
    const resMp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    const dataMp = await resMp.json();
    if (!resMp.ok) return resposta(502, { erro: 'Mercado Pago recusou a consulta' });

    if (dataMp.status === 'approved' && dataMp.payment_method_id === 'pix' && dataMp.external_reference) {
      const ok = await liberarAssinatura({
        supaUrl, supaServiceKey,
        userId: dataMp.external_reference,
        dias: 30,
        plano: 'mensal',
        pixPaymentId: dataMp.id,
      });
      console.log('Pix avulso liberado via polling da tela:', { userId: dataMp.external_reference, paymentId: dataMp.id, ok });
    }

    return resposta(200, { status: dataMp.status });
  } catch (e) {
    return resposta(502, { erro: 'Erro ao falar com o Mercado Pago: ' + e.message });
  }
};
