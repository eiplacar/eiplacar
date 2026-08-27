// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — consulta o status de um pagamento Pix específico
// direto na API do Mercado Pago, pelo paymentId devolvido por
// criar-pagamento-pix.js. Usada pelo front pra saber com certeza se
// FOI ESSE pagamento que foi aprovado — checar só "a assinatura está
// liberada?" no Supabase é falha, porque a pessoa pode já estar com
// acesso liberado por outro motivo (teste grátis, plano anterior).
//
// Chamada pelo app em: POST /.netlify/functions/verificar-pagamento-pix
//   body: { "paymentId": "123456789" }
//   header: Authorization: Bearer <token da sessão Supabase do usuário>
// Devolve: { status: "approved" | "pending" | "rejected" | ... }
// ═══════════════════════════════════════════════════

function resposta(statusCode, corpo) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) };
}

export const handler = async function (event) {
  if (event.httpMethod !== 'POST') return resposta(405, { erro: 'Método não permitido' });

  const mpToken = process.env.MP_ACCESS_TOKEN;
  const supaUrl = process.env.SUPABASE_URL;
  const supaAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!mpToken || !supaUrl || !supaAnonKey) {
    return resposta(500, { erro: 'Faltam variáveis de ambiente' });
  }

  let paymentId;
  try { paymentId = JSON.parse(event.body || '{}').paymentId; } catch { return resposta(400, { erro: 'Corpo inválido' }); }
  if (!paymentId) return resposta(400, { erro: 'paymentId é obrigatório' });

  // Só confirma quem está logado (não precisa ser dono do pagamento — o
  // front só usa isso pra saber quando parar de esperar, nada sensível é
  // devolvido além do status).
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
    return resposta(200, { status: dataMp.status });
  } catch (e) {
    return resposta(502, { erro: 'Erro ao falar com o Mercado Pago: ' + e.message });
  }
};
