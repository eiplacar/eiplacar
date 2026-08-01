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
// simples como na API-Football, e sim strings tipo "cmr77dvww...").
const LIGAS_PERMITIDAS = new Set([
  'cmr77dvww00bfrx061thkr8z4', // Brasileirão Série A
  'cmr77dvww00bgrx06cb9fmnv0', // Brasileirão Série B
  'cmr77dvkr005nrx06lp7rvp49', // Premier League (Inglaterra)
  'cmr77dvnt006nrx063v3w622e', // La Liga (Espanha)
  'cmr77dvgm0002rx06rt2uqxii', // Bundesliga (Alemanha)
  'cmr77dvgm0001rx060h6ivt4p', // Bundesliga 2
  'cmr77dvpd006yrx06zig7907g', // Serie A (Itália)
  'cmr77dvqg007crx06q1kaceyo', // Ligue 1 (França)
  'cmr77dvrh007vrx0664phtxs5', // Eredivisie (Holanda)
  'cmr77dw3900f5rx06j05wgzv4', // UEFA Champions League
]);

// A GOAL API cobre o mundo inteiro (500+ ligas), então uma busca por data
// sem filtro de liga pode ter centenas de jogos — por isso pagina em blocos
// de 100 até acabar (ou até a trava de segurança de 1000 jogos no total).
async function buscarTodosFixturesDoDia(apiKey, data) {
  const LIMITE_POR_PAGINA = 100;
  const MAX_PAGINAS = 10;
  let todos = [];
  let offset = 0;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const resp = await fetch(`${GOAL_API_URL}/fixtures?date=${data}&limit=${LIMITE_POR_PAGINA}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      throw new Error(`GOAL API respondeu com erro ${resp.status}`);
    }

    const json = await resp.json();
    if (!json.success) {
      throw new Error(json.message || 'GOAL API recusou a chamada');
    }

    todos = todos.concat(json.data || []);

    if (!json.pagination?.hasMore) break;
    offset += LIMITE_POR_PAGINA;
  }

  return todos;
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

function horarioBR(matchDate, matchTime) {
  if (!matchDate || !matchTime) return '';
  const dt = new Date(`${matchDate}T${matchTime}:00Z`);
  if (Number.isNaN(dt.getTime())) return '';
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

    const jogos = todosFixtures
      .filter((f) => LIGAS_PERMITIDAS.has(f.leagueId))
      .map((f) => ({
        id: f.id,
        campeonato: f.leagueName,
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
