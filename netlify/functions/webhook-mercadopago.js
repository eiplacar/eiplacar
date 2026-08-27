// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — recebe as notificações (webhook) do Mercado
// Pago quando uma assinatura é autorizada ou uma cobrança recorrente
// é paga, e atualiza o Supabase automaticamente — mesma coisa que o
// organizador hoje faz na mão em Administração → Usuários
// (adminAprovarPlano / adminRenovarPlano).
//
// Configurar essa URL como webhook no painel do Mercado Pago:
//   Suas integrações → aplicação → Webhooks → URL de produção:
//   https://SEU-SITE.netlify.app/.netlify/functions/webhook-mercadopago
//   Eventos: "Assinaturas" (subscription_preapproval e subscription_authorized_payment)
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
async function liberarAssinatura({ supaUrl, supaServiceKey, userId, dias }) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: supaServiceKey,
    Authorization: `Bearer ${supaServiceKey}`,
    Prefer: 'return=representation',
  };
  const base = supaUrl.replace(/\/$/, '');

  const resAtual = await fetch(`${base}/rest/v1/perfis?id=eq.${userId}&select=assinatura_vencimento`, { headers });
  const atual = resAtual.ok ? await resAtual.json() : [];
  const vencAtual = atual?.[0]?.assinatura_vencimento;
  const hoje = hojeSaoPaulo();
  const dataBase = (vencAtual && vencAtual >= hoje) ? vencAtual : hoje;

  const resUpdate = await fetch(`${base}/rest/v1/perfis?id=eq.${userId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ assinatura_status: 'ativo', assinatura_vencimento: somarDias(dataBase, dias) }),
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
  try { payload = JSON.parse(event.body || '{}'); } catch { return resposta(400); }
  const tipo = payload.type || payload.topic;
  const id = payload.data?.id || payload['data.id'] || event.queryStringParameters?.id;
  console.log('Webhook Mercado Pago recebido:', { tipo, id });
  if (!id) return resposta(200); // notificação sem id útil — confirma recebido e ignora

  try {
    // ── Assinatura autorizada pela primeira vez (pessoa acabou de confirmar
    // o pagamento/cartão no checkout) ──
    if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
      const { ok, data } = await mpFetch(`/preapproval/${id}`, mpToken);
      if (!ok) { console.log('Preapproval não encontrado na API do MP:', id); return resposta(200); }
      console.log('Preapproval consultado:', { id, status: data.status, external_reference: data.external_reference });

      if (data.status === 'authorized') {
        const chave = `${data.auto_recurring?.frequency}-${data.auto_recurring?.frequency_type}`;
        const dias = DIAS_POR_FREQUENCIA[chave] || 30;
        const ok2 = await liberarAssinatura({ supaUrl, supaServiceKey, userId: data.external_reference, dias });
        console.log('Assinatura liberada:', { userId: data.external_reference, dias, ok: ok2 });
      }
      return resposta(200);
    }

    // ── Cobrança recorrente (renovação automática mensal/trimestral/semestral) ──
    if (tipo === 'subscription_authorized_payment') {
      const { ok, data } = await mpFetch(`/authorized_payments/${id}`, mpToken);
      if (!ok) { console.log('Authorized payment não encontrado na API do MP:', id); return resposta(200); }
      console.log('Cobrança recorrente consultada:', { id, status: data.status, preapproval_id: data.preapproval_id });

      if (data.status === 'approved' && data.preapproval_id) {
        const { ok: okPre, data: preapproval } = await mpFetch(`/preapproval/${data.preapproval_id}`, mpToken);
        if (okPre && preapproval.external_reference) {
          const chave = `${preapproval.auto_recurring?.frequency}-${preapproval.auto_recurring?.frequency_type}`;
          const dias = DIAS_POR_FREQUENCIA[chave] || 30;
          const ok2 = await liberarAssinatura({ supaUrl, supaServiceKey, userId: preapproval.external_reference, dias });
          console.log('Assinatura renovada:', { userId: preapproval.external_reference, dias, ok: ok2 });
        }
      }
      return resposta(200);
    }

    // outros tipos de evento (ex: pagamento avulso, que não usamos aqui) — ignora
    return resposta(200);
  } catch (e) {
    console.log('Erro processando webhook:', e.message);
    return resposta(200); // sempre 200 pro Mercado Pago não ficar retentando pra sempre
  }
};
