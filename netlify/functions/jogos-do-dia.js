// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — busca os jogos do dia na GOAL API
// (goal-api.com). Roda no servidor da Netlify, não no navegador
// do usuário — por isso a chave da API (GOAL_API_KEY) fica
// escondida, configurada como variável de ambiente no painel da Netlify.
//
// Chamada pelo app em: /.netlify/functions/jogos-do-dia?data=AAAA-MM-DD
// ═══════════════════════════════════════════════════

const GOAL_API_URL = 'https://api.goal-api.com/v1';

// Ligas que aparecem na busca — IDs da GOAL API (não são mais números
// simples como na API-Football, e sim strings tipo "cmr77dvww...") →
// nome do campeonato que aparece no app. Mesma lista/nomes de
// atualizar-jogos-finalizados.js — importante manter os dois iguais,
// senão um jogo salvo por uma função e outro pela outra ficam com
// nomes de campeonato diferentes ("Serie A" vs "Brasileirão Série A")
// e o app trata como campeonatos distintos.
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
const LIGAS_PERMITIDAS = new Set(NOMES_CAMP_POR_LIGA.keys());

// País de cada liga, pelo mesmo ID — não depende do nome (GOAL API manda o
// nome dela mesma, "leagueName", que não necessariamente bate com o nome
// que o app usa). Mesma lista de países de atualizar-jogos-finalizados.js.
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
]);

// A GOAL API cobre o mundo inteiro (500+ ligas). Buscar tudo por "date" sem leagueId
// parece só devolver as ligas mais populares — ligas menores (ex: 2. Bundesliga,
// Eredivisie) não apareciam mesmo estando na lista de permitidas. O outro arquivo,
// atualizar-jogos-finalizados.js, já tinha descoberto (comentário lá) que a API ignora
// o filtro "date" quando combinado com "leagueId" — então aqui adotamos o MESMO padrão
// que já funciona pra ele: busca por liga (leagueId), sem "date", e filtra a data
// aqui no código (via matchDate). Mais chamadas (1 por liga permitida), mas garante
// que TODAS as ligas configuradas apareçam, não só as grandes.
async function buscarTodosFixturesDoDia(apiKey, data) {
  const LIMITE_POR_LIGA = 30; // cobre folgado a "rodada" de qualquer liga em torno da data buscada
  let todos = [];

  for (const ligaId of LIGAS_PERMITIDAS) {
    const resp = await fetch(`${GOAL_API_URL}/fixtures?leagueId=${ligaId}&limit=${LIMITE_POR_LIGA}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      console.log(`GOAL API respondeu com erro ${resp.status} pra liga ${ligaId}`);
      continue; // não derruba a busca inteira por causa de 1 liga com problema
    }

    const json = await resp.json();
    if (!json.success) {
      console.log(`GOAL API recusou a chamada pra liga ${ligaId}:`, json.message);
      continue;
    }

    console.log(`Liga ${ligaId}: ${(json.data || []).length} fixture(s) recebido(s), datas:`, [...new Set((json.data || []).map((f) => f.matchDate))]);
    todos = todos.concat(json.data || []);
  }

  return todos.filter((f) => f.matchDate === data);
}

// A GOAL API não deixa explícito o fuso horário do "matchTime" — assumindo
// UTC aqui (padrão mais comum entre provedores de dados esportivos). Se os
// horários saírem errados depois do deploy (comparando com um jogo que você
// sabe a hora real), é só ajustar essa função (ex: trocar o "Z" do final
// por um offset fixo, tipo "-03:00").
// A GOAL API manda "matchRound" como número puro (ex: "21"), diferente da
// API-Football que mandava um texto tipo "Regular Season - 21". Se vier só
// número, adiciona o "Rodada " na frente; se já vier outro texto (grupos,
// fases eliminatórias etc.), deixa como está.
function formatarRodada(matchRound) {
  const bruto = (matchRound || '').toString().trim();
  if (!bruto) return '';
  return /^\d+$/.test(bruto) ? `Rodada ${bruto}` : bruto;
}

// A GOAL API não deixa explícito o fuso horário do "matchTime". O código estava
// assumindo UTC, mas o relato foi de jogo chegando 2h a mais que o horário real —
// o suspeito mais provável é a API mandar o horário LOCAL da liga (ex: ligas
// europeias em horário de verão = UTC+2 em agosto: tratar como UTC e converter pra
// Brasília erra 2h a mais, exatamente o relatado). Como não dá pra confirmar sem
// comparar com um jogo real ao vivo, deixei um ajuste manual aqui: comece com -2
// (compensa os 2h relatados), suba pro próximo jogo e confira contra o horário
// real de transmissão; se ainda estiver errado, ajuste esse número até bater.
const AJUSTE_FUSO_HORAS = -2;

function horarioBR(matchDate, matchTime) {
  if (!matchDate || !matchTime) return '';
  const dt = new Date(`${matchDate}T${matchTime}:00Z`);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setUTCHours(dt.getUTCHours() + AJUSTE_FUSO_HORAS);
  return dt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export const handler = async function (event) {
  const apiKey = process.env.GOAL_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'GOAL_API_KEY não configurada nas variáveis de ambiente da Netlify.' }),
    };
  }

  const params = event.queryStringParameters || {};
  // Mesma correção de fuso horário do front-end (ver hojeBR em public/js/04-utils.js):
  // `new Date().toISOString()` usa UTC, e por isso "virava o dia" 3h antes da hora certa
  // de Brasília. Aqui no backend (Node) não existe `window`, então repetimos a lógica.
  const hojeBrasilia = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const data = params.data || hojeBrasilia;

  try {
    const todosFixtures = await buscarTodosFixturesDoDia(apiKey, data);
    console.log(`Total de fixtures recebidos (todas as ligas permitidas, filtrados pra ${data}):`, todosFixtures.length);

    const jogos = todosFixtures
      .filter((f) => LIGAS_PERMITIDAS.has(f.leagueId))
      .map((f) => ({
        id: f.id,
        campeonato: NOMES_CAMP_POR_LIGA.get(f.leagueId) || f.leagueName,
        pais: PAIS_POR_LIGA.get(f.leagueId) || '',
        rodada: formatarRodada(f.matchRound),
        casa: f.homeTeamName,
        vis: f.awayTeamName,
        escudoCasa: f.teamHomeBadge,
        escudoVis: f.teamAwayBadge,
        horario: horarioBR(f.matchDate, f.matchTime),
      }))
      .sort((a, b) => a.horario.localeCompare(b.horario));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogos }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao buscar jogos', detalhe: String(e) }) };
  }
};
