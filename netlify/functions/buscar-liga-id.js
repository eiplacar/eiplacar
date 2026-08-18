// ═══════════════════════════════════════════════════
// FUNÇÃO DE USO ÚNICO — tenta descobrir o leagueId da GOAL API pra Liga Portugal
// e Liga MX, testando alguns formatos de endpoint comuns (não sabemos de antemão
// qual a GOAL API usa pra buscar/listar ligas por nome ou país). Chame manualmente:
//   /.netlify/functions/buscar-liga-id?nome=Portugal
//   /.netlify/functions/buscar-liga-id?nome=Mexico
// Devolve o que cada tentativa de endpoint respondeu, pra a gente ver qual funcionou
// e pegar o leagueId certo. Pode apagar esse arquivo depois de usar.
// ═══════════════════════════════════════════════════

const GOAL_API_URL = 'https://api.goal-api.com/v1';

export const handler = async function (event) {
  const apiKey = process.env.GOAL_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ erro: 'GOAL_API_KEY não configurada.' }) };
  }
  const nome = event.queryStringParameters?.nome || 'Portugal';
  const headers = { Authorization: `Bearer ${apiKey}` };

  const tentativas = [
    { rota: `/leagues?search=${encodeURIComponent(nome)}`, },
    { rota: `/leagues?name=${encodeURIComponent(nome)}`, },
    { rota: `/leagues?country=${encodeURIComponent(nome)}`, },
    { rota: `/countries?search=${encodeURIComponent(nome)}`, },
    { rota: `/leagues`, }, // lista geral, se existir — vamos filtrar pelo nome localmente
  ];

  const resultados = {};
  for (const t of tentativas) {
    try {
      const resp = await fetch(`${GOAL_API_URL}${t.rota}`, { headers });
      const texto = await resp.text();
      let corpo;
      try { corpo = JSON.parse(texto); } catch { corpo = texto.slice(0, 500); }
      // Se a rota devolveu uma lista grande (ex: "/leagues" geral), filtra só o que bate com o nome
      if (corpo && Array.isArray(corpo.data)) {
        const filtrado = corpo.data.filter((l) => JSON.stringify(l).toLowerCase().includes(nome.toLowerCase()));
        resultados[t.rota] = { httpStatus: resp.status, totalNaLista: corpo.data.length, filtradoPeloNome: filtrado.slice(0, 15) };
      } else {
        resultados[t.rota] = { httpStatus: resp.status, corpo };
      }
    } catch (e) {
      resultados[t.rota] = { erro: String(e) };
    }
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resultados, null, 2) };
};
