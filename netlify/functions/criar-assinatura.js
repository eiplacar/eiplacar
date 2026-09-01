// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — gera um link de PAGAMENTO ÚNICO no Mercado Pago
// (Checkout Pro / API de Preferências) pra liberar 30/90/180 dias de
// acesso. NÃO É MAIS ASSINATURA RECORRENTE: o Mercado Pago não guarda
// cartão nem cobra de novo sozinho no futuro — quando o período acabar,
// a pessoa decide se quer voltar aqui e pagar de novo ou não. A pessoa
// escolhe cartão, Pix, boleto etc. direto na tela do Checkout Pro — não
// existe mais um fluxo de Pix separado dentro do app.
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
//   SUPABASE_ANON_KEY     → chave "anon" do Supabase (Settings → API) — usada
//                            aqui pra validar o token de quem chamou e buscar
//                            nome/telefone do perfil (mandados pro Mercado Pago
//                            junto com o pagamento, pra ajudar a aprovação).
//   APP_URL                → URL pública do app (ex: https://eiplacar.netlify.app),
//                            pra onde o Mercado Pago devolve a pessoa depois de pagar.
//                            PRECISA ser https:// (Mercado Pago recusa back_url http/localhost
//                            para o retorno automático "auto_return").
// ═══════════════════════════════════════════════════

// Mesmo mapeamento usado na aprovação manual (Administração → Usuários),
// pra ficar tudo consistente não importa qual meio de pagamento (cartão,
// Pix, boleto) ou quem processou (automático ou aprovação manual do organizador).
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

  // Nome e telefone do perfil — o Mercado Pago recomenda mandar o máximo de dados
  // possível do comprador (documentação: "Como melhorar a aprovação dos pagamentos"),
  // porque isso ajuda a análise antifraude a confiar mais na transação. Busca opcional:
  // se falhar ou faltar telefone/nome, segue sem eles (só o e-mail já é obrigatório).
  let nome = '', sobrenome = '', telefoneArea = '', telefoneNumero = '';
  try {
    const resPerfil = await fetch(`${supaUrl.replace(/\/$/, '')}/rest/v1/perfis?id=eq.${usuario.id}&select=nome,telefone`, {
      headers: { apikey: supaAnonKey, Authorization: `Bearer ${token}` },
    });
    const dataPerfil = resPerfil.ok ? await resPerfil.json() : [];
    const perfil = dataPerfil?.[0] || {};
    if (perfil.nome) {
      const partes = perfil.nome.trim().split(/\s+/);
      nome = partes[0] || '';
      sobrenome = partes.slice(1).join(' ') || '';
    }
    const digitos = (perfil.telefone || '').replace(/\D/g, '');
    if (digitos.length >= 10) { telefoneArea = digitos.slice(0, 2); telefoneNumero = digitos.slice(2); }
  } catch {}

  // Cria a preferência de PAGAMENTO ÚNICO (Checkout Pro) — a pessoa escolhe
  // cartão, Pix, boleto etc. na página segura do Mercado Pago e paga uma
  // vez só. Sem "auto_recurring", sem preapproval: nada fica agendado pra
  // cobrar de novo no futuro.
  const corpo = {
    items: [{
      id: `plano-${planoId}`,
      title: `EI PLACAR — Plano ${plano.nome} (${plano.dias} dias, pagamento único)`,
      description: `Acesso à plataforma EI PLACAR por ${plano.dias} dias — plano ${plano.nome}`,
      category_id: 'services', // ajuda a análise de risco a entender o tipo de produto (ver "Como melhorar a aprovação dos pagamentos" na doc do Mercado Pago)
      quantity: 1,
      unit_price: Number(preco),
      currency_id: 'BRL',
    }],
    payer: {
      email: usuario.email,
      ...(nome ? { name: nome } : {}),
      ...(sobrenome ? { surname: sobrenome } : {}),
      ...(telefoneArea ? { phone: { area_code: telefoneArea, number: telefoneNumero } } : {}),
    },
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
