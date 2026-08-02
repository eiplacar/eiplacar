// ═══════════════════════════════════════════════════
// FUNÇÃO MANUAL (não é agendada, não roda sozinha) — importa a temporada
// inteira da Premier League 2025/2026 da GOAL API (goal-api.com) pro
// Supabase, com estatísticas completas (chutes, escanteios, cartões,
// gols por minuto), igual aos jogos que já são salvos automaticamente
// pela atualizar-jogos-finalizados.js.
//
// Não mexe em nada que já existe: não altera atualizar-jogos-finalizados.js,
// não altera o netlify.toml (não fica agendada), não altera nenhuma tabela —
// só insere linhas na tabela "jogos" já existente, do mesmo jeito que a
// função de atualização automática já faz.
//
// COMO USAR (depois do deploy):
//   Abra no navegador (ou chame com curl):
//   https://SEU-SITE.netlify.app/.netlify/functions/importar-temporada-premier-league?confirmar=sim
//
//   A GOAL API não deixa buscar 380 jogos de uma vez só (o servidor da
//   Netlify tem um limite de tempo por chamada), então essa função processa
//   um LOTE por vez (30 jogos) e devolve no JSON quantos já foram salvos e
//   quantos ainda faltam. Chame a mesma URL de novo (é seguro repetir —
//   jogos já salvos não são buscados de novo) até a resposta trazer
//   "faltam": 0.
//
// Variáveis de ambiente necessárias (as MESMAS já configuradas no painel
// da Netlify pra atualizar-jogos-finalizados.js — nada novo pra configurar):
//   GOAL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
// ═══════════════════════════════════════════════════

const GOAL_API_URL = 'https://api.goal-api.com/v1';

// Mesmo ID da Premier League usado em jogos-do-dia.js e
// atualizar-jogos-finalizados.js — copiado de lá, não inventado.
const PREMIER_LEAGUE_ID = 'cmr77dvkr005nrx06lp7rvp49';
const NOME_CAMPEONATO = 'Premier League';

// Quantos jogos (que ainda não estão completos no banco) processar por
// chamada. Cada um custa 1 chamada de detalhe (+1 de standings, cacheada
// por liga). Número baixo o suficiente pra não estourar o tempo limite da
// função da Netlify.
const LOTE_POR_EXECUCAO = 30;

function formatarRodada(matchRound) {
  const bruto = (matchRound || '').toString().trim();
  if (!bruto) return '';
  return /^\d+$/.test(bruto) ? `Rodada ${bruto}` : bruto;
}

function pegarEstatistica(estatisticas, tipo, lado) {
  const item = (estatisticas || []).find((s) => s.type === tipo);
  if (!item) return null;
  const bruto = String(item[lado] ?? '').replace('%', '').trim();
  if (bruto === '') return null;
  const n = parseInt(bruto, 10);
  return Number.isNaN(n) ? null : n;
}

function parseMinuto(tempo) {
  if (!tempo) return 0;
  return String(tempo)
    .split('+')
    .reduce((soma, parte) => soma + (parseInt(parte, 10) || 0), 0);
}

function extrairGols(eventos, nomeCasa, nomeVis) {
  return (eventos || [])
    .filter((ev) => ev.type === 'GOAL')
    .map((ev) => {
      const daCasa = !!ev.homeScorer;
      return {
        min: parseMinuto(ev.time),
        time: daCasa ? 'casa' : 'vis',
        nome: daCasa ? nomeCasa : nomeVis,
      };
    })
    .sort((a, b) => a.min - b.min);
}

// Busca TODOS os fixtures da Premier League (a GOAL API já devolve a
// temporada atual automaticamente, sem precisar mandar o ano — mesmo
// comportamento observado em buscarRanksDaLiga da atualizar-jogos-
// finalizados.js). Pagina em blocos de 100 até acabar.
async function buscarTodosFixturesDaLiga(apiKey) {
  const LIMITE_POR_PAGINA = 100;
  const MAX_PAGINAS = 10; // trava de segurança: até 1000 jogos
  let todos = [];
  let offset = 0;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const resp = await fetch(
      `${GOAL_API_URL}/fixtures?leagueId=${PREMIER_LEAGUE_ID}&limit=${LIMITE_POR_PAGINA}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const json = await resp.json();
    console.log(`Resposta GOAL API (fixtures liga=${PREMIER_LEAGUE_ID}, offset=${offset}):`, {
      httpStatus: resp.status, success: json.success, recebidos: (json.data || []).length,
    });

    if (!resp.ok || !json.success) {
      throw new Error(json.message || `GOAL API respondeu com erro ${resp.status}`);
    }

    todos = todos.concat(json.data || []);

    if (!json.pagination?.hasMore) break;
    offset += LIMITE_POR_PAGINA;
  }

  return todos;
}

async function buscarMapaClubes(supaUrl, supaServiceKey) {
  const mapa = new Map();
  try {
    const res = await fetch(`${supaUrl}/rest/v1/clubes?select=api_team_id,nome`, {
      headers: { apikey: supaServiceKey, Authorization: `Bearer ${supaServiceKey}` },
    });
    if (res.ok) {
      const linhas = await res.json();
      linhas.forEach((c) => { if (c.api_team_id) mapa.set(c.api_team_id, c.nome); });
    }
  } catch (e) { /* segue com o mapa vazio — usa o nome cru da API como fallback */ }
  return mapa;
}

function nomeDoTime(mapaClubes, teamId, nomeCru) {
  return mapaClubes.get(teamId) || nomeCru;
}

async function buscarRanksDaLiga(apiKey) {
  const resp = await fetch(`${GOAL_API_URL}/leagues/${PREMIER_LEAGUE_ID}/standings`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await resp.json();
  console.log('Resposta GOAL API (standings Premier League):', {
    httpStatus: resp.status, success: json.success, qtdTimes: (json.data || []).length,
  });

  const mapa = new Map();
  (json.data || []).forEach((t) => {
    const pos = parseInt(t.overallLeaguePosition, 10);
    if (t.teamId && !Number.isNaN(pos)) mapa.set(t.teamId, pos);
  });

  return { mapa, indisponivel: !json.success };
}

async function buscarDetalheDoJogo(apiKey, fixtureId) {
  const resp = await fetch(`${GOAL_API_URL}/fixtures/${fixtureId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await resp.json();
  return json.success ? json.data : null;
}

export const handler = async function (event) {
  const apiKey = process.env.GOAL_API_KEY;
  const supaUrl = process.env.SUPABASE_URL;
  const supaServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!apiKey || !supaUrl || !supaServiceKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: 'Faltam variáveis de ambiente (GOAL_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY) — as mesmas já usadas em atualizar-jogos-finalizados.js.' }),
    };
  }

  // Proteção simples pra não rodar sem querer (ex: um bot/crawler batendo
  // na URL). Precisa mandar ?confirmar=sim.
  const params = event.queryStringParameters || {};
  if (params.confirmar !== 'sim') {
    return {
      statusCode: 400,
      body: JSON.stringify({ erro: 'Chame com ?confirmar=sim na URL pra rodar a importação da temporada.' }),
    };
  }

  try {
    const todosFixtures = await buscarTodosFixturesDaLiga(apiKey);
    console.log('Total de fixtures da Premier League recebidos da GOAL API:', todosFixtures.length);

    if (todosFixtures.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, mensagem: 'A GOAL API não devolveu nenhum jogo pra Premier League.' }) };
    }

    // Descobre quais desses jogos já estão salvos e completos no Supabase
    // (mesma lógica da atualizar-jogos-finalizados.js), pra não gastar cota
    // de novo — e pra essa função poder ser chamada várias vezes até
    // terminar sem duplicar nem reprocessar o que já deu certo.
    const todosIds = todosFixtures.map((f) => parseInt(f.apiId, 10)).filter((n) => !Number.isNaN(n));
    const existentesCompletos = new Set();
    // Consulta em blocos de 150 ids pra não estourar limite de tamanho de URL.
    for (let i = 0; i < todosIds.length; i += 150) {
      const bloco = todosIds.slice(i, i + 150);
      const resp = await fetch(
        `${supaUrl}/rest/v1/jogos?select=fixture_id,chutesC,rankC,rankV,rank_indisponivel&fixture_id=in.(${bloco.join(',')})`,
        { headers: { apikey: supaServiceKey, Authorization: `Bearer ${supaServiceKey}` } }
      );
      if (!resp.ok) {
        const erro = await resp.text();
        return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao consultar jogos existentes no Supabase', detalhe: erro }) };
      }
      const linhas = await resp.json();
      linhas.forEach((r) => {
        const rankFaltando = (r.rankC === null || r.rankV === null) && !r.rank_indisponivel;
        const incompleto = r.chutesC === null || rankFaltando;
        if (!incompleto) existentesCompletos.add(r.fixture_id);
      });
    }

    const pendentes = todosFixtures.filter((f) => !existentesCompletos.has(parseInt(f.apiId, 10)));
    console.log('Jogos pendentes de importar/completar:', pendentes.length, 'de', todosFixtures.length, 'no total.');

    if (pendentes.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, mensagem: 'Temporada inteira já estava importada e completa.', totalNaTemporada: todosFixtures.length }) };
    }

    // Só processa um lote por execução (ver LOTE_POR_EXECUCAO no topo).
    const loteAtual = pendentes.slice(0, LOTE_POR_EXECUCAO);

    const mapaClubes = await buscarMapaClubes(supaUrl, supaServiceKey);
    const { mapa: ranks, indisponivel: rankIndisponivel } = await buscarRanksDaLiga(apiKey);

    const linhas = [];
    for (const f of loteAtual) {
      const finalizado = f.status === 'FINISHED';
      // Só busca o detalhe (estatísticas + eventos) pra jogo já finalizado —
      // jogo futuro/não jogado ainda não tem essa informação na API mesmo.
      const detalhe = finalizado ? await buscarDetalheDoJogo(apiKey, f.id) : null;

      const casaCorrigido = nomeDoTime(mapaClubes, f.homeTeamId, f.homeTeamName);
      const visCorrigido = nomeDoTime(mapaClubes, f.awayTeamId, f.awayTeamName);
      const gols = extrairGols(detalhe?.events, f.homeTeamName, f.awayTeamName);
      const stats = detalhe?.statistics || [];

      linhas.push({
        fixture_id: parseInt(f.apiId, 10),
        origem: 'goal-api',
        camp: NOME_CAMPEONATO,
        data: f.matchDate,
        rodada: formatarRodada(f.matchRound),
        local: f.matchStadium || '',
        casa: casaCorrigido,
        vis: visCorrigido,
        gC: f.homeTeamScore !== null ? parseInt(f.homeTeamScore, 10) : null,
        gV: f.awayTeamScore !== null ? parseInt(f.awayTeamScore, 10) : null,
        rankC: ranks.get(f.homeTeamId) ?? null,
        rankV: ranks.get(f.awayTeamId) ?? null,
        rank_indisponivel: rankIndisponivel,
        gols,
        golsHT_C: f.homeTeamHalftimeScore !== null ? parseInt(f.homeTeamHalftimeScore, 10) : null,
        golsHT_V: f.awayTeamHalftimeScore !== null ? parseInt(f.awayTeamHalftimeScore, 10) : null,
        chutesC: pegarEstatistica(stats, 'Shots Total', 'home'),
        chutesV: pegarEstatistica(stats, 'Shots Total', 'away'),
        chutesGolC: pegarEstatistica(stats, 'Shots On Goal', 'home'),
        chutesGolV: pegarEstatistica(stats, 'Shots On Goal', 'away'),
        escanteiosC: pegarEstatistica(stats, 'Corners', 'home'),
        escanteiosV: pegarEstatistica(stats, 'Corners', 'away'),
        amarelosC: pegarEstatistica(stats, 'Yellow Cards', 'home'),
        amarelosV: pegarEstatistica(stats, 'Yellow Cards', 'away'),
        vermelhosC: pegarEstatistica(stats, 'Red Cards', 'home'),
        vermelhosV: pegarEstatistica(stats, 'Red Cards', 'away'),
      });
    }

    const respSalvar = await fetch(`${supaUrl}/rest/v1/jogos?on_conflict=fixture_id`, {
      method: 'POST',
      headers: {
        apikey: supaServiceKey,
        Authorization: `Bearer ${supaServiceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(linhas),
    });

    if (!respSalvar.ok) {
      const erro = await respSalvar.text();
      console.log('ERRO ao salvar no Supabase:', erro);
      return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao salvar no Supabase', detalhe: erro }) };
    }

    const faltam = pendentes.length - loteAtual.length;
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        totalNaTemporada: todosFixtures.length,
        salvosNessaChamada: linhas.length,
        faltam,
        mensagem: faltam > 0
          ? `Salvos ${linhas.length} jogos. Faltam ${faltam} — chame essa mesma URL de novo pra continuar.`
          : `Salvos ${linhas.length} jogos. Temporada 2025/2026 da Premier League importada por completo!`,
      }),
    };
  } catch (e) {
    console.log('ERRO na importação da temporada:', e);
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao importar temporada', detalhe: String(e) }) };
  }
};
