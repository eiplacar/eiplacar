// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — recebe os webhooks da GOAL API (goal-api.com/dashboard/webhooks)
// e salva o estado ao vivo do jogo na tabela "jogos_ao_vivo". Diferente das outras duas
// funções (jogos-do-dia.js, atualizar-jogos-finalizados.js), essa aqui NÃO chama a GOAL
// API — é a GOAL API que chama a GENTE (push), então não gasta cota de chamada nenhuma
// pra receber o evento.
//
// URL a colocar no campo "Endpoint URL" do painel da GOAL API:
//   https://SEU-SITE.netlify.app/.netlify/functions/goal-webhook?secret=SEU_SEGREDO
//
// Variáveis de ambiente necessárias (painel da Netlify):
//   SUPABASE_URL          → mesma URL de sempre
//   SUPABASE_SERVICE_KEY  → chave "service_role" (mesma das outras funções)
//   GOAL_WEBHOOK_SECRET   → uma senha qualquer, inventada por você (ex: gere uma
//                            string aleatória). Tem que ser IGUAL ao "?secret=" que
//                            você colocar na URL lá no painel da GOAL API — é a única
//                            trava que garante que quem está chamando essa função é
//                            mesmo a GOAL API, e não qualquer um que descobrir a URL.
//
// IMPORTANTE — formato do payload: a GOAL API ainda não tinha documentação pública
// do FORMATO exato do corpo do webhook no momento em que essa função foi escrita.
// Por isso ela tenta reconhecer o payload em alguns formatos prováveis (ver
// extrairEvento abaixo) e, o mais importante: LOGA o corpo bruto de cada chamada
// recebida (console.log) — dá pra ver esses logs em Netlify → Functions → goal-webhook
// → Logs assim que o primeiro jogo real começar. Se o placar/minuto não aparecer
// certo no app, é só me mandar um desses logs que eu ajusto o mapeamento de campos.
// ═══════════════════════════════════════════════════

// Mesma lista de ligas permitidas das outras duas funções — só processa (e só
// grava) evento de jogo que seja de uma dessas 12 ligas. Evento de qualquer
// outra liga é ignorado (retorna 200 igual, só não grava nada).
const NOMES_CAMP_POR_LIGA = new Map([
  ['cmr77dvww00bfrx061thkr8z4', 'Brasileirão Série A'],
  ['cmr77dvww00bgrx06cb9fmnv0', 'Brasileirão Série B'],
  ['cmr77dvkr005nrx06lp7rvp49', 'Premier League'],
  ['cmr77dvnt006nrx063v3w622e', 'La Liga'],
  ['cmr77dvgm0002rx06rt2uqxii', 'Bundesliga'],
  ['cmr77dvgm0001rx060h6ivt4p', '2. Bundesliga'],
  ['cmr77dvpd006yrx06zig7907g', 'Serie A'],
  ['cmr77dvqg007crx06q1kaceyo', 'Ligue 1'],
  ['cmr77dvrh007vrx0664phtxs5', 'Eredivisie'],
  ['cmr77dw3900f5rx06j05wgzv4', 'UEFA Champions League'],
  ['cmr77dvun00adrx06xz20yfxe', 'Primeira Liga'],
  ['cmr77dvsv008srx06mier6t7r', 'Liga MX'],
]);
const PAIS_POR_LIGA = new Map([
  ['cmr77dvww00bfrx061thkr8z4', 'Brasil'],
  ['cmr77dvww00bgrx06cb9fmnv0', 'Brasil'],
  ['cmr77dvkr005nrx06lp7rvp49', 'Inglaterra'],
  ['cmr77dvnt006nrx063v3w622e', 'Espanha'],
  ['cmr77dvgm0002rx06rt2uqxii', 'Alemanha'],
  ['cmr77dvgm0001rx060h6ivt4p', 'Alemanha'],
  ['cmr77dvpd006yrx06zig7907g', 'Itália'],
  ['cmr77dvqg007crx06q1kaceyo', 'França'],
  ['cmr77dvrh007vrx0664phtxs5', 'Holanda'],
  ['cmr77dw3900f5rx06j05wgzv4', 'Europa'],
  ['cmr77dvun00adrx06xz20yfxe', 'Portugal'],
  ['cmr77dvsv008srx06mier6t7r', 'México'],
]);

function horarioBR(matchDate, matchTime) {
  if (!matchDate || !matchTime) return '';
  const dt = new Date(`${matchDate}T${matchTime}:00Z`);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

// A GOAL API pode mandar o "corpo do jogo" em algum desses formatos comuns —
// tentamos achar em qualquer um deles. Também aceita o objeto já "achatado"
// direto na raiz (sem "data"/"match"/"fixture" por fora).
function pegarObjJogo(body) {
  return body?.data || body?.match || body?.fixture || body || {};
}
function pegarTipoEvento(body) {
  return body?.event || body?.type || body?.eventType || body?.event_type || '';
}

function extrairEvento(body) {
  const tipo = String(pegarTipoEvento(body) || '').toLowerCase();
  const j = pegarObjJogo(body);

  const leagueId = j.leagueId || j.league_id || j.competitionId || j.competition_id;
  const fixtureIdBruto = j.apiId ?? j.fixtureId ?? j.fixture_id ?? j.id ?? j.matchId ?? j.match_id;
  const fixtureId = parseInt(fixtureIdBruto, 10);

  return {
    tipo,
    leagueId,
    fixtureId: Number.isNaN(fixtureId) ? null : fixtureId,
    casa: j.homeTeamName || j.home_team_name || j.homeTeam?.name || j.home?.name,
    vis: j.awayTeamName || j.away_team_name || j.awayTeam?.name || j.away?.name,
    gc: j.homeTeamScore ?? j.home_score ?? j.homeScore ?? j.score?.home ?? 0,
    gv: j.awayTeamScore ?? j.away_score ?? j.awayScore ?? j.score?.away ?? 0,
    minuto: j.matchMinute ?? j.minute ?? j.elapsed ?? j.time ?? null,
    matchDate: j.matchDate || j.match_date,
    matchTime: j.matchTime || j.match_time,
  };
}

export const handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erro: 'Método não permitido, use POST' }) };
  }

  const segredoEsperado = process.env.GOAL_WEBHOOK_SECRET;
  const segredoRecebido = (event.queryStringParameters || {}).secret;
  if (!segredoEsperado) {
    console.log('ERRO: GOAL_WEBHOOK_SECRET não configurada nas variáveis de ambiente da Netlify.');
    return { statusCode: 500, body: JSON.stringify({ erro: 'GOAL_WEBHOOK_SECRET não configurada' }) };
  }
  if (segredoRecebido !== segredoEsperado) {
    console.log('Webhook recusado: segredo ausente ou incorreto.');
    return { statusCode: 401, body: JSON.stringify({ erro: 'Não autorizado' }) };
  }

  const supaUrl = process.env.SUPABASE_URL;
  const supaServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supaUrl || !supaServiceKey) {
    console.log('ERRO: faltam SUPABASE_URL / SUPABASE_SERVICE_KEY nas variáveis de ambiente.');
    return { statusCode: 500, body: JSON.stringify({ erro: 'Faltam variáveis de ambiente do Supabase' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    console.log('ERRO: corpo do webhook não é um JSON válido:', event.body);
    return { statusCode: 400, body: JSON.stringify({ erro: 'JSON inválido' }) };
  }

  // Log do payload bruto — essencial pra conferir/ajustar o mapeamento de campos
  // assim que os primeiros eventos reais chegarem (ver comentário no topo do arquivo).
  console.log('Webhook recebido da GOAL API:', JSON.stringify(body));

  const ev = extrairEvento(body);
  console.log('Evento interpretado:', ev);

  if (!ev.fixtureId) {
    console.log('Ignorado: não achei um ID de jogo reconhecível nesse payload.');
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignorado: 'sem fixtureId' }) };
  }
  if (!NOMES_CAMP_POR_LIGA.has(ev.leagueId)) {
    console.log(`Ignorado: liga ${ev.leagueId} não está nas ligas permitidas do app.`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignorado: 'liga fora da lista' }) };
  }

  // match.finished (ou variações de nome) → marca como encerrado, mas mantém o
  // registro por um tempo (o app esconde sozinho depois de umas horas, mesma
  // regra usada em "Jogos Agendados"). match.started → ao_vivo. Qualquer outro
  // evento reconhecido (ex: goal.scored) também deixa como "ao_vivo" (o jogo já
  // começou, só saiu gol) e atualiza o placar.
  let status = 'ao_vivo';
  if (tipoEhFinalizado(ev.tipo)) status = 'encerrado';
  else if (tipoEhInicio(ev.tipo)) status = 'ao_vivo';

  const linha = {
    fixture_id: ev.fixtureId,
    camp: NOMES_CAMP_POR_LIGA.get(ev.leagueId),
    pais: PAIS_POR_LIGA.get(ev.leagueId),
    casa: ev.casa || 'Mandante',
    vis: ev.vis || 'Visitante',
    gc: parseInt(ev.gc, 10) || 0,
    gv: parseInt(ev.gv, 10) || 0,
    status,
    minuto: ev.minuto !== null && ev.minuto !== undefined ? String(ev.minuto) : null,
    horario: horarioBR(ev.matchDate, ev.matchTime) || undefined,
    atualizado_em: new Date().toISOString(),
  };
  // undefined vira omitido no JSON.stringify — evita sobrescrever um horário já
  // salvo antes com "vazio" quando esse evento em particular não trouxe matchTime.
  Object.keys(linha).forEach((k) => linha[k] === undefined && delete linha[k]);

  try {
    const resp = await fetch(`${supaUrl}/rest/v1/jogos_ao_vivo?on_conflict=fixture_id`, {
      method: 'POST',
      headers: {
        apikey: supaServiceKey,
        Authorization: `Bearer ${supaServiceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([linha]),
    });
    if (!resp.ok) {
      const erro = await resp.text();
      console.log('ERRO ao salvar no Supabase:', erro);
      return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao salvar no Supabase', detalhe: erro }) };
    }
  } catch (e) {
    console.log('ERRO de rede ao salvar no Supabase:', e.message);
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha de rede ao salvar', detalhe: e.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};

function tipoEhFinalizado(tipo) {
  return /finish|finished|end|ft\b/.test(tipo);
}
function tipoEhInicio(tipo) {
  return /start|started|kickoff|kick_off/.test(tipo);
}
