// ═══════════════════════════════════════════════════
// FUNÇÃO DE USO ÚNICO — lista todos os times (id + nome + escudo) do
// Brasileirão Série A e Série B na GOAL API, pra facilitar repopular a
// tabela "clubes" no Supabase (coluna api_team_id) com os IDs certos da
// GOAL API, já que os que estão lá hoje provavelmente são da API antiga.
//
// Não roda sozinha (sem "schedule") — chame manualmente:
//   /.netlify/functions/listar-clubes-brasileirao
// Devolve um JSON com a lista de times de cada liga, já ordenada por nome.
// Depois de usar pra repopular a tabela, pode apagar esse arquivo — ele não
// é usado em nenhum outro lugar do app.
// ═══════════════════════════════════════════════════

const GOAL_API_URL = 'https://api.goal-api.com/v1';

const LIGAS = [
  { id: 'cmr77dvww00bfrx061thkr8z4', nome: 'Brasileirão Série A' },
  { id: 'cmr77dvww00bgrx06cb9fmnv0', nome: 'Brasileirão Série B' },
];

// Busca várias páginas de jogos da liga (independente de status/data) e junta
// os times únicos que aparecem como casa/visitante — cobre a temporada toda,
// então pega os 20 times mesmo que alguns só apareçam em rodadas específicas.
async function listarTimesDaLiga(apiKey, ligaId) {
  const times = new Map(); // id -> { nome, escudo }
  let offset = 0;
  const LIMITE = 50;

  for (let pagina = 0; pagina < 6; pagina++) { // até 300 fixtures — sobra pra 38 rodadas de 20 times
    const resp = await fetch(`${GOAL_API_URL}/fixtures?leagueId=${ligaId}&limit=${LIMITE}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) break;
    const json = await resp.json();
    if (!json.success || !(json.data || []).length) break;

    for (const f of json.data) {
      if (f.homeTeamId) times.set(f.homeTeamId, { nome: f.homeTeamName, escudo: f.teamHomeBadge });
      if (f.awayTeamId) times.set(f.awayTeamId, { nome: f.awayTeamName, escudo: f.teamAwayBadge });
    }

    if (json.data.length < LIMITE) break; // já era a última página
    offset += LIMITE;
  }

  return [...times.entries()]
    .map(([id, t]) => ({ api_team_id: id, nome: t.nome, escudo: t.escudo }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export const handler = async function () {
  const apiKey = process.env.GOAL_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ erro: 'GOAL_API_KEY não configurada nas variáveis de ambiente da Netlify.' }) };
  }

  try {
    const resultado = {};
    for (const liga of LIGAS) {
      const lista = await listarTimesDaLiga(apiKey, liga.id);
      resultado[liga.nome] = { total: lista.length, times: lista };
      console.log(`${liga.nome}: ${lista.length} time(s)`, lista.map((t) => `${t.nome} (${t.api_team_id})`));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultado, null, 2),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao buscar times', detalhe: String(e) }) };
  }
};
