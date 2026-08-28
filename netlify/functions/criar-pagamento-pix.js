// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — gera um pagamento Pix AVULSO (não recorrente) pro
// plano mensal. Diferente de criar-assinatura.js (que usa a API de
// Assinaturas/preapproval, só cartão), essa aqui usa a API de Pagamentos
// comum do Mercado Pago (/v1/payments com payment_method_id "pix"), pra
// quem não tem cartão ou não quer renovação automática.
//
// Depois que os 30 dias acabam, a pessoa precisa voltar e pagar de novo —
// não tem cobrança automática nesse fluxo.
//
// Chamada pelo app em: POST /.netlify/functions/criar-pagamento-pix
//   body: { "cpf": "12345678900" }
//   header: Authorization: Bearer <token da sessão Supabase do usuário>
//
// Devolve: { qrCode: "<código copia-e-cola>", qrCodeBase64: "<imagem em base64>", paymentId }
//
// Variáveis de ambiente: as mesmas de criar-assinatura.js
//   (MP_ACCESS_TOKEN / SUPABASE_URL / SUPABASE_ANON_KEY)
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
    console.log('ERRO: faltam variáveis de ambiente', { temMpToken: !!mpToken, temSupaUrl: !!supaUrl, temSupaAnonKey: !!supaAnonKey });
    return resposta(500, { erro: 'Faltam variáveis de ambiente (MP_ACCESS_TOKEN / SUPABASE_URL / SUPABASE_ANON_KEY)' });
  }

  let cpf;
  try { cpf = String(JSON.parse(event.body || '{}').cpf || '').replace(/\D/g, ''); } catch { return resposta(400, { erro: 'Corpo da requisição inválido' }); }
  if (cpf.length !== 11) return resposta(400, { erro: 'CPF inválido' });

  // Confirma quem está chamando (mesmo padrão de criar-assinatura.js).
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer /i, '');
  if (!token) return resposta(401, { erro: 'Não autenticado' });

  let usuario;
  try {
    const resUser = await fetch(`${supaUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: supaAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!resUser.ok) return resposta(401, { erro: 'Sessão inválida ou expirada' });
    usuario = await resUser.json();
  } catch (e) {
    return resposta(401, { erro: 'Não foi possível validar a sessão: ' + e.message });
  }
  if (!usuario?.id || !usuario?.email) return resposta(401, { erro: 'Sessão inválida' });

  let preco;
  try {
    const resCfg = await fetch(`${supaUrl.replace(/\/$/, '')}/rest/v1/config_app?id=eq.1&select=dados`, {
      headers: { apikey: supaAnonKey, Authorization: `Bearer ${token}` },
    });
    const dataCfg = resCfg.ok ? await resCfg.json() : [];
    preco = dataCfg?.[0]?.dados?.precoMensal;
  } catch {}
  if (!preco || preco <= 0) return resposta(500, { erro: 'Preço do plano mensal não configurado (Administração → Sistema).' });

  const nomes = (usuario.user_metadata?.nome || usuario.email.split('@')[0] || 'Assinante').trim().split(' ');
  const expiraEm = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos a partir de agora
  const corpo = {
    transaction_amount: Number(preco),
    description: 'EI PLACAR — 1 mês de acesso (Pix avulso)',
    payment_method_id: 'pix',
    external_reference: usuario.id, // usado no webhook pra saber de quem é o pagamento
    metadata: { plano_id: 'mensal', dias: 30 }, // usado no webhook/verificação pra saber quantos dias liberar (mesmo padrão do pagamento único por cartão)
    date_of_expiration: expiraEm.toISOString(), // ISO8601 em UTC — o Mercado Pago aceita normalmente
    payer: {
      email: usuario.email,
      first_name: nomes[0],
      last_name: nomes.slice(1).join(' ') || nomes[0],
      identification: { type: 'CPF', number: cpf },
    },
  };

  try {
    const resMp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpToken}`,
        'X-Idempotency-Key': `${usuario.id}-${Date.now()}`,
      },
      body: JSON.stringify(corpo),
    });
    const dataMp = await resMp.json();
    const qr = dataMp.point_of_interaction?.transaction_data;
    console.log('Resposta Mercado Pago (criar pagamento Pix):', { httpStatus: resMp.status, id: dataMp.id, temQr: !!qr?.qr_code });
    if (!resMp.ok || !qr?.qr_code) {
      return resposta(502, { erro: 'Mercado Pago recusou o pagamento: ' + (dataMp.message || JSON.stringify(dataMp)) });
    }
    return resposta(200, { qrCode: qr.qr_code, qrCodeBase64: qr.qr_code_base64, paymentId: dataMp.id });
  } catch (e) {
    return resposta(502, { erro: 'Erro ao falar com o Mercado Pago: ' + e.message });
  }
};
