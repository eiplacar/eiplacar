// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — gera um link de PAGAMENTO ÚNICO no Mercado Pago
// (Checkout Pro / API de Preferências) pra liberar 30/90/180 dias de
// acesso. NÃO É MAIS ASSINATURA RECORRENTE: o Mercado Pago não guarda
// cartão nem cobra de novo sozinho no futuro — quando o período acabar,
// a pessoa decide se quer voltar aqui e pagar de novo ou não.
//
// (Endpoint mantido com o nome "criar-assinatura" pra não precisar mudar
// o front nem a config da Netlify — mas o que ele faz hoje é 100% pagamento
// avulso, igual ao Pix de criar-pagamento-pix.js, só que também aceita
// cartão/outros meios do Checkout Pro além de Pix.)
//
// Chamada pelo app em: POST /.netlify/functions/criar-assinatura
//   body: { "planoId": "mensal" | "trimestral" | "semestral" }
//   header: Authorization: Bearer <token da sessão Supabase do usuário>
//
// Devolve: { checkoutUrl: "https://www.mercadopago.com.br/checkout/..." }
// O app só precisa redirecionar (window.location.href = checkoutUrl).
// Depois de pagar, o Mercado Pago devolve a pessoa pra APP_URL com
// ?payment_id=...&status=approved na querystring — o app confere e libera
// o acesso na hora (ver verificarRetornoPagamentoCartao em 16-admin.js),
// e o webhook (webhook-mercadopago.js) é o reforço caso a pessoa feche
// a aba antes disso.
//
// Variáveis de ambiente necessárias (painel da Netlify):
//   MP_ACCESS_TOKEN       → Access Token do Mercado Pago (teste ou produção)
//   SUPABASE_URL          → mesma URL do public/js/01-config-auth.js
//   SUPABASE_ANON_KEY     → chave "anon" do Supabase (Settings → API) — só
//                            usada aqui pra validar o token de quem chamou.
//   APP_URL                → URL pública do app (ex: https://eiplacar.netlify.app),
//                            pra onde o Mercado Pago devolve a pessoa depois de pagar.
//                            PRECISA ser https:// (Mercado Pago recusa back_url http/localhost
//                            para o retorno automático "auto_return").
// ═══════════════════════════════════════════════════

// Mesmo mapeamento usado na aprovação manual (Administração → Usuários) e no
// Pix avulso, pra ficar tudo consistente não importa qual meio de pagamento
// ou quem processou (automático ou aprovação manual do organizador).
const PLANOS = {
  mensal:     { nome: 'Mensal',     dias: 30,  precoCampo: 'precoMensal' },
  trimestral: { nome: 'Trimestral', dias: 90,  precoCampo: 'precoTrimestral' },
  semestral:  { nome: 'Semestral',  dias: 180, precoCampo: 'precoSemestral' },
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) };
}

export const handler = async function (event) {
  if (event.httpMethod !== 'POST') return resposta(405, { erro: 'Método não permitido' });

  const mpToken = process.env.MP_ACCESS_TOKEN;
  const supaUrl = process.env.SUPABASE_URL;
  const supaAnonKey = process.env.SUPABASE_ANON_KEY;
  const appUrl = (process.env.APP_URL || 'https://eiplacar.com.br').replace(/\/$/, '');

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

  // Cria a preferência de PAGAMENTO ÚNICO (Checkout Pro) — a pessoa escolhe
  // cartão, Pix, boleto etc. na página segura do Mercado Pago e paga uma
  // vez só. Sem "auto_recurring", sem preapproval: nada fica agendado pra
  // cobrar de novo no futuro.
  const corpo = {
    items: [{
      title: `EI PLACAR — Plano ${plano.nome} (${plano.dias} dias, pagamento único)`,
      quantity: 1,
      unit_price: Number(preco),
      currency_id: 'BRL',
    }],
    payer: { email: usuario.email },
    external_reference: usuario.id, // usado no webhook/verificação pra saber de quem é o pagamento
    metadata: { plano_id: planoId, dias: plano.dias }, // usado no webhook/verificação pra saber quantos dias liberar
    back_urls: {
      success: `${appUrl}/?pagamento=sucesso`,
      failure: `${appUrl}/?pagamento=falhou`,
      pending: `${appUrl}/?pagamento=pendente`,
    },
    auto_return: 'approved',
    statement_descriptor: 'EI PLACAR',
  };

  try {
    const resMp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
      body: JSON.stringify(corpo),
    });
    const dataMp = await resMp.json();
    console.log('Resposta Mercado Pago (criar preferência de pagamento único):', { httpStatus: resMp.status, id: dataMp.id, temInitPoint: !!dataMp.init_point });
    if (!resMp.ok || !dataMp.init_point) {
      return resposta(502, { erro: 'Mercado Pago recusou a criação do pagamento: ' + (dataMp.message || JSON.stringify(dataMp)) });
    }
    return resposta(200, { checkoutUrl: dataMp.init_point });
  } catch (e) {
    return resposta(502, { erro: 'Erro ao falar com o Mercado Pago: ' + e.message });
  }
};
