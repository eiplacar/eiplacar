// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — cancela a assinatura recorrente (cartão) do usuário
// logado. Isso PARA as próximas cobranças no Mercado Pago, mas NÃO tira
// o acesso na hora — a pessoa já pagou o período atual, então continua
// com acesso até `assinatura_vencimento`. Depois disso, a trava normal
// do app (assinaturaVencida) bloqueia sozinha, porque não vai chegar
// mais nenhum webhook de renovação.
//
// Chamada pelo app em: POST /.netlify/functions/cancelar-assinatura
//   header: Authorization: Bearer <token da sessão Supabase do usuário>
//
// Usa só o token do PRÓPRIO usuário pra ler/gravar seu perfil (a RLS já
// deixa cada um ler/editar a própria linha em "perfis") — não precisa da
// service_role aqui.
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
    return resposta(500, { erro: 'Faltam variáveis de ambiente (MP_ACCESS_TOKEN / SUPABASE_URL / SUPABASE_ANON_KEY)' });
  }

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
  if (!usuario?.id) return resposta(401, { erro: 'Sessão inválida' });

  const headersSupa = { apikey: supaAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = supaUrl.replace(/\/$/, '');

  let mpId;
  try {
    const resPerfil = await fetch(`${base}/rest/v1/perfis?id=eq.${usuario.id}&select=assinatura_mp_id`, { headers: headersSupa });
    const perfil = resPerfil.ok ? await resPerfil.json() : [];
    mpId = perfil?.[0]?.assinatura_mp_id;
  } catch (e) {
    return resposta(500, { erro: 'Erro ao buscar seu perfil: ' + e.message });
  }
  if (!mpId) return resposta(400, { erro: 'Nenhuma assinatura recorrente encontrada pra cancelar.' });

  try {
    const resMp = await fetch(`https://api.mercadopago.com/preapproval/${mpId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    const dataMp = await resMp.json();
    console.log('Cancelamento de assinatura no Mercado Pago:', { httpStatus: resMp.status, mpId, status: dataMp.status });
    if (!resMp.ok) return resposta(502, { erro: 'Mercado Pago recusou o cancelamento: ' + (dataMp.message || JSON.stringify(dataMp)) });
  } catch (e) {
    return resposta(502, { erro: 'Erro ao falar com o Mercado Pago: ' + e.message });
  }

  try {
    await fetch(`${base}/rest/v1/perfis?id=eq.${usuario.id}`, {
      method: 'PATCH',
      headers: { ...headersSupa, Prefer: 'return=representation' },
      body: JSON.stringify({ assinatura_cancelada: true }),
    });
  } catch (e) {
    console.log('Cancelou no Mercado Pago mas falhou ao marcar no Supabase:', e.message);
  }

  return resposta(200, { ok: true });
};
