// ═══════════════════════════════════════════════════
// FUNÇÃO SERVERLESS — busca os jogos do dia na API-Football
// Roda no servidor da Netlify, não no navegador do usuário —
// por isso a chave da API (API_FOOTBALL_KEY) fica escondida,
// configurada como variável de ambiente no painel da Netlify.
//
// Chamada pelo app em: /.netlify/functions/jogos-do-dia?data=AAAA-MM-DD
// ═══════════════════════════════════════════════════

// Ligas que aparecem na busca — ajuste essa lista como quiser.
// IDs conferidos em https://dashboard.api-football.com/soccer/ids/leagues
const LIGAS_PERMITIDAS = new Set([
  71,  // Brasileirão Série A
  72,  // Brasileirão Série B
  73,  // Copa do Brasil
  13,  // Copa Libertadores
  11,  // Copa Sul-Americana
  2,   // Champions League
  3,   // Europa League
  39,  // Premier League (Inglaterra)
  140, // La Liga (Espanha)
  135, // Serie A (Itália)
  78,  // Bundesliga (Alemanha)
  61,  // Ligue 1 (França)
]);

export const handler = async function (event) {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'API_FOOTBALL_KEY não configurada nas variáveis de ambiente da Netlify.' }),
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
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${data}`, {
      headers: { 'x-apisports-key': apiKey },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: JSON.stringify({ erro: `API-Football respondeu com erro ${resp.status}` }),
      };
    }

    const json = await resp.json();

    if (json.errors && Object.keys(json.errors).length > 0) {
      return { statusCode: 400, body: JSON.stringify({ erro: 'API-Football recusou a chamada', detalhe: json.errors }) };
    }

    const jogos = (json.response || [])
      .filter((f) => LIGAS_PERMITIDAS.has(f.league?.id))
      .map((f) => ({
        id: f.fixture.id,
        campeonato: f.league.name,
        rodada: f.league.round || '',
        casa: f.teams.home.name,
        vis: f.teams.away.name,
        escudoCasa: f.teams.home.logo,
        escudoVis: f.teams.away.logo,
        horario: new Date(f.fixture.date).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        }),
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
