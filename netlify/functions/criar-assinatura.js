// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — cria o link de checkout de assinatura no
// Mercado Pago (Checkout Pro / API de Assinaturas — "preapproval").
// Roda no servidor (Netlify), não no navegador — o MP_ACCESS_TOKEN
// nunca aparece no app.
//
// Chamada pelo app em: POST /.netlify/functions/criar-assinatura
//   body: { "planoId": "mensal" | "trimestral" | "semestral" }
//   header: Authorization: Bearer <token da sessão Supabase do usuário>
//
// Devolve: { checkoutUrl: "https://www.mercadopago.com.br/subscriptions/..." }
// O app só precisa redirecionar (window.location.href = checkoutUrl).
//
// Variáveis de ambiente necessárias (painel da Netlify):
//   MP_ACCESS_TOKEN       → Access Token do Mercado Pago (teste ou produção)
//   SUPABASE_URL          → mesma URL do public/js/01-config-auth.js
//   SUPABASE_ANON_KEY     → chave "anon" do Supabase (Settings → API) — só
//                            usada aqui pra validar o token de quem chamou,
//                            não precisa da service_role nessa function.
//   APP_URL                → URL pública do app (ex: https://eiplacar.netlify.app),
//                            pra onde o Mercado Pago devolve a pessoa depois de pagar.
// ═══════════════════════════════════════════════════

// Mesmo mapeamento usado na aprovação manual (Administração → Usuários),
// pra ficar tudo consistente não importa se o plano veio de pagamento
// automático ou de aprovação manual do organizador.
const PLANOS = {
  mensal:     { nome: 'Mensal',     dias: 30,  frequency: 1, frequency_type: 'months', precoCampo: 'precoMensal' },
  trimestral: { nome: 'Trimestral', dias: 90,  frequency: 3, frequency_type: 'months', precoCampo: 'precoTrimestral' },
  semestral:  { nome: 'Semestral',  dias: 180, frequency: 6, frequency_type: 'months', precoCampo: 'precoSemestral' },
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) };
}

export const handler = async function (event) {
  if (event.httpMethod !== 'POST') return resposta(405, { erro: 'Método não permitido' });

  const mpToken = process.env.MP_ACCESS_TOKEN;
  const supaUrl = process.env.SUPABASE_URL;
  const supaAnonKey = process.env.SUPABASE_ANON_KEY;
  const appUrl = process.env.APP_URL;

  if (!mpToken || !supaUrl || !supaAnonKey) {
    console.log('ERRO: faltam variáveis de ambiente', { temMpToken: !!mpToken, temSupaUrl: !!supaUrl, temSupaAnonKey: !!supaAnonKey });
    return resposta(500, { erro: 'Faltam variáveis de ambiente (MP_ACCESS_TOKEN / SUPABASE_URL / SUPABASE_ANON_KEY)' });
  }

  let planoId;
  try {
    planoId = JSON.parse(event.body || '{}').planoId;
  } catch {
    return resposta(400, { erro: 'Corpo da requisição inválido' });
  }
  const plano = PLANOS[planoId];
  if (!plano) return resposta(400, { erro: 'Plano inválido. Use mensal, trimestral ou semestral.' });

  // Confirma quem está chamando (nunca confia em id/e-mail vindo do corpo da
  // requisição — só no token de sessão, que o Supabase valida pra gente).
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

  // Preço atual vem do config_app (o mesmo que o organizador edita em
  // Administração → Sistema) — assim não precisa mexer em código quando
  // o preço mudar, só no painel.
  let preco;
  try {
    const resCfg = await fetch(`${supaUrl.replace(/\/$/, '')}/rest/v1/config_app?id=eq.1&select=dados`, {
      headers: { apikey: supaAnonKey, Authorization: `Bearer ${token}` },
    });
    const dataCfg = resCfg.ok ? await resCfg.json() : [];
    preco = dataCfg?.[0]?.dados?.[plano.precoCampo];
  } catch {}
  if (!preco || preco <= 0) return resposta(500, { erro: 'Preço do plano não configurado (Administração → Sistema).' });

  // Cria a assinatura direto na API (sem precisar de plano pré-cadastrado no
  // painel do Mercado Pago — "assinatura sem plano associado"). O Mercado
  // Pago devolve um "init_point": o link de checkout hospedado por eles,
  // onde a pessoa escolhe cartão/Pix e confirma.
  const corpo = {
    reason: `EI PLACAR — Plano ${plano.nome}`,
    external_reference: usuario.id, // usado no webhook pra saber de quem é o pagamento
    payer_email: usuario.email,
    back_url: appUrl || 'https://eiplacar.com.br',
    auto_recurring: {
      frequency: plano.frequency,
      frequency_type: plano.frequency_type,
      transaction_amount: Number(preco),
      currency_id: 'BRL',
    },
  };

  try {
    const resMp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
      body: JSON.stringify(corpo),
    });
    const dataMp = await resMp.json();
    console.log('Resposta Mercado Pago (criar preapproval):', { httpStatus: resMp.status, id: dataMp.id, temInitPoint: !!dataMp.init_point });
    if (!resMp.ok || !dataMp.init_point) {
      return resposta(502, { erro: 'Mercado Pago recusou a criação da assinatura: ' + (dataMp.message || JSON.stringify(dataMp)) });
    }
    return resposta(200, { checkoutUrl: dataMp.init_point });
  } catch (e) {
    return resposta(502, { erro: 'Erro ao falar com o Mercado Pago: ' + e.message });
  }
};
