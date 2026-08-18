// ═══════════════════════════════════════════════════
// FUNÇÃO DE USO ÚNICO — lista as ligas da GOAL API (endpoint /leagues, confirmado que
// funciona e devolve 50 por página) e filtra localmente pelo nome/país. Os parâmetros
// ?search=/?name=/?country= parecem não filtrar de verdade no servidor (sempre voltam
// as mesmas 50 primeiras) — por isso pagina tudo e filtra aqui no código.
// Chame manualmente, sem parâmetro nenhum (já busca Portugal e México de uma vez):
//   /.netlify/functions/buscar-liga-id
// Pode apagar esse arquivo depois de usar.
// ═══════════════════════════════════════════════════

const GOAL_API_URL = 'https://api.goal-api.com/v1';
const TERMOS = ['portugal', 'mexico', 'méxico', 'liga mx', 'primeira liga'];

export const handler = async function () {
  const apiKey = process.env.GOAL_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ erro: 'GOAL_API_KEY não configurada.' }) };
  }
  const headers = { Authorization: `Bearer ${apiKey}` };
  const LIMITE = 50;
  let offset = 0;
  let todasLigas = [];

  for (let pagina = 0; pagina < 20; pagina++) { // até 1000 ligas — a GOAL API cobre o mundo inteiro
    const resp = await fetch(`${GOAL_API_URL}/leagues?limit=${LIMITE}&offset=${offset}`, { headers });
    if (!resp.ok) break;
    const json = await resp.json();
    const dados = json.data || [];
    if (!dados.length) break;
    todasLigas = todasLigas.concat(dados);
    if (dados.length < LIMITE) break; // última página
    offset += LIMITE;
  }

  const encontradas = todasLigas.filter((l) => {
    const texto = JSON.stringify(l).toLowerCase();
    return TERMOS.some((termo) => texto.includes(termo));
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalLigasVarridas: todasLigas.length, encontradas }, null, 2),
  };
};
