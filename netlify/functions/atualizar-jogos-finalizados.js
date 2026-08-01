// ═══════════════════════════════════════════════════
// FUNÇÃO AGENDADA — roda sozinha de tempos em tempos (ver o
// "schedule" configurado no netlify.toml), busca os jogos que
// TERMINARAM hoje nos campeonatos escolhidos, pega as estatísticas
// completas (chutes, escanteios, cartões etc.) e salva no Supabase.
//
// Só gasta cota da API pros jogos que ainda não foram salvos —
// jogo que já está no banco nunca é buscado de novo.
//
// Variáveis de ambiente necessárias (configurar no painel da Netlify):
//   GOAL_API_KEY          → chave da GOAL API (goal-api.com)
//   SUPABASE_URL          → mesma URL do public/js/01-config-auth.js
//   SUPABASE_SERVICE_KEY  → chave "service_role" do Supabase (Settings → API)
//                            NUNCA usar a chave anon aqui — precisa da
//                            service_role pra poder escrever sem estar logado.
// ═══════════════════════════════════════════════════

const GOAL_API_URL = 'https://api.goal-api.com/v1';

// IDs das ligas na GOAL API → nome do campeonato que aparece no app.
// Mesma lista de 10 ligas usada em jogos-do-dia.js.
const NOMES_CAMP_POR_LIGA = new Map([
  ['cmr77dvww00bfrx061thkr8z4', 'Brasileirão Série A'],
  ['cmr77dvww00bgrx06cb9fmnv0', 'Brasileirão Série B'],
  ['cmr77dvkr005nrx06lp7rvp49', 'Premier League'],
  ['cmr77dvnt006nrx063v3w622e', 'La Liga'],
  ['cmr77dvgm0002rx06rt2uqxii', 'Bundesliga'],
  ['cmr77dvgm0001rx060h6ivt4p', 'Bundesliga 2'],
  ['cmr77dvpd006yrx06zig7907g', 'Serie A (Itália)'],
  ['cmr77dvqg007crx06q1kaceyo', 'Ligue 1'],
  ['cmr77dvrh007vrx0664phtxs5', 'Eredivisie'],
  ['cmr77dw3900f5rx06j05wgzv4', 'UEFA Champions League'],
]);

function dataHojeSaoPaulo() {
  const agora = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(agora); // AAAA-MM-DD
}

function dataOntemSaoPaulo() {
  // Pega "agora" já subtraindo 1 dia, e formata do jeito de São Paulo —
  // assim evita bug de fuso horário na virada do dia.
  const agora = new Date();
  agora.setUTCDate(agora.getUTCDate() - 1);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(agora);
}

// A GOAL API já manda matchDate como "AAAA-MM-DD" (sem hora), então só
// repassamos — mantido como função pra deixar explícito o formato esperado
// pelo resto do site (mesmo "AAAA-MM-DD" usado em jogos.data).
function dataBrParaTexto(matchDate) {
  return matchDate;
}

// Estatísticas da GOAL API vêm como uma lista achatada — cada item tem
// {type, home, away} em vez de um objeto por time como na API-Football.
function pegarEstatistica(estatisticas, tipo, lado) {
  const item = (estatisticas || []).find((s) => s.type === tipo);
  if (!item) return null;
  const bruto = String(item[lado] ?? '').replace('%', '').trim();
  if (bruto === '') return null;
  const n = parseInt(bruto, 10);
  return Number.isNaN(n) ? null : n;
}

// "45", "90+3" etc. — soma os acréscimos pro minuto final do gol.
function parseMinuto(tempo) {
  if (!tempo) return 0;
  return String(tempo)
    .split('+')
    .reduce((soma, parte) => soma + (parseInt(parte, 10) || 0), 0);
}

// Os eventos da GOAL API não trazem o nome do time que fez o gol — só
// indicam o lado (homeScorer preenchido = gol da casa; awayScorer = visitante).
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

// ═══════════════════════════════════════════════════
// NOMES DE TIMES — via tabela "clubes" (ID da API → nome do sistema)
// Muito mais confiável que tentar corrigir por texto (acento, grafia
// etc.): o ID do time na GOAL API nunca muda, então a busca é exata.
// Times que ainda não estão na tabela "clubes" continuam usando o nome
// cru que a API manda (fallback), sem quebrar nada.
// ═══════════════════════════════════════════════════
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
  } catch (e) { /* se der erro, segue com o mapa vazio — usa o nome cru da API como fallback */ }
  return mapa;
}

function nomeDoTime(mapaClubes, teamId, nomeCru) {
  return mapaClubes.get(teamId) || nomeCru;
}

// 1 chamada por liga (reaproveitada pra todos os jogos dessa liga nessa rodada da função).
// A GOAL API já devolve a classificação da temporada atual automaticamente —
// não precisa mais calcular/mandar o ano da temporada como na API-Football.
// Devolve { mapa, indisponivel }: "indisponivel" é true quando a API não conseguiu
// devolver a tabela dessa liga (ex: liga sem classificação disponível ainda).
async function buscarRanksDaLiga(apiKey, ligaId, cacheStandings) {
  if (cacheStandings.has(ligaId)) return cacheStandings.get(ligaId);

  const resp = await fetch(`${GOAL_API_URL}/leagues/${ligaId}/standings`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await resp.json();
  console.log(`Resposta GOAL API (standings liga=${ligaId}):`, { httpStatus: resp.status, success: json.success, qtdTimes: (json.data || []).length });

  const mapa = new Map();
  (json.data || []).forEach((t) => {
    const pos = parseInt(t.overallLeaguePosition, 10);
    if (t.teamId && !Number.isNaN(pos)) mapa.set(t.teamId, pos);
  });

  const indisponivel = !json.success;
  const resultado = { mapa, indisponivel };
  cacheStandings.set(ligaId, resultado);
  return resultado;
}

// 1 chamada por jogo novo — o detalhe do fixture na GOAL API já vem com
// eventos, cartões e estatísticas embutidos, então não precisa mais de
// chamadas separadas pra "events" e "statistics" como na API-Football.
async function buscarDetalheDoJogo(apiKey, fixtureId) {
  const resp = await fetch(`${GOAL_API_URL}/fixtures/${fixtureId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await resp.json();
  console.log(`Resposta GOAL API (fixture=${fixtureId}):`, { httpStatus: resp.status, success: json.success, qtdEventos: (json.data?.events || []).length, qtdStats: (json.data?.statistics || []).length });
  return json.success ? json.data : null;
}

export const handler = async function () {
  const apiKey = process.env.GOAL_API_KEY;
  const supaUrl = process.env.SUPABASE_URL;
  const supaServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!apiKey || !supaUrl || !supaServiceKey) {
    console.log('ERRO: faltam variáveis de ambiente', { temApiKey: !!apiKey, temSupaUrl: !!supaUrl, temSupaKey: !!supaServiceKey });
    return { statusCode: 500, body: JSON.stringify({ erro: 'Faltam variáveis de ambiente (GOAL_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY)' }) };
  }

  const hoje = dataHojeSaoPaulo();

  // Sempre confere hoje E ontem, em qualquer horário — assim jogos que terminaram
  // tarde da noite (ou que passaram batido numa execução anterior) nunca ficam de fora,
  // e rodar manualmente pelo "Run Now" da Netlify a qualquer hora do dia também funciona.
  // Custa só 1 chamada extra de "fixtures" (lista), bem mais barata que a chamada de
  // detalhe (que já traz estatística + gols juntos).
  const datasValidas = new Set([hoje, dataOntemSaoPaulo()]);
  console.log('Buscando jogos finalizados para as datas:', [...datasValidas]);

  // IMPORTANTE: a GOAL API ignora o filtro "date" quando combinado com "leagueId"
  // (bug/limitação observada) — em vez disso devolve os jogos mais recentes
  // daquela liga, do mais novo pro mais antigo. Por isso buscamos por liga
  // (poucas chamadas, uma por liga) e filtramos a data aqui no código.
  let todosFixtures = [];
  for (const ligaId of NOMES_CAMP_POR_LIGA.keys()) {
    const resp = await fetch(`${GOAL_API_URL}/fixtures?leagueId=${ligaId}&status=FINISHED&limit=20`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = await resp.json();
    console.log(`Resposta GOAL API (fixtures liga=${ligaId}):`, { httpStatus: resp.status, success: json.success, totalRecebido: (json.data || []).length });
    if (!json.success) continue;
    todosFixtures = todosFixtures.concat(json.data || []);
  }

  const fixtures = todosFixtures.filter((f) => NOMES_CAMP_POR_LIGA.has(f.leagueId) && datasValidas.has(f.matchDate));
  console.log('Jogos após filtro de ligas permitidas:', fixtures.length, fixtures.map((f) => `${NOMES_CAMP_POR_LIGA.get(f.leagueId)} - ${f.homeTeamName} x ${f.awayTeamName}`));

  if (fixtures.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, mensagem: 'Nenhum jogo finalizado hoje nos campeonatos escolhidos.' }) };
  }

  // Descobre quais desses jogos já estão salvos, pra não gastar cota de novo.
  // fixture_id no Supabase é bigint — por isso usamos o "apiId" numérico da
  // GOAL API (não o "id" alfanumérico tipo "cmrzltnb9v...") como identificador.
  const idsHoje = fixtures.map((f) => f.apiId);
  const respExistentes = await fetch(
    `${supaUrl}/rest/v1/jogos?select=fixture_id,chutesC,rankC,rankV,rank_indisponivel&fixture_id=in.(${idsHoje.join(',')})`,
    { headers: { apikey: supaServiceKey, Authorization: `Bearer ${supaServiceKey}` } }
  );
  const textoExistentes = await respExistentes.text();
  console.log('Resposta Supabase (verificação de existentes):', { httpStatus: respExistentes.status, corpo: textoExistentes });

  if (!respExistentes.ok) {
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao consultar jogos existentes no Supabase', detalhe: textoExistentes }) };
  }

  // Jogos que JÁ existem mas foram salvos com "chutesC" vazio, OU com o ranking ("rankC"/
  // "rankV") vazio E ainda sem a marca de "rank_indisponivel" (ou seja: ainda vale a pena
  // tentar de novo), entram de novo na lista pra tentar completar o que faltou. Jogos com
  // ranking vazio MAS já marcados como rank_indisponivel=true não entram — evita ficar
  // gastando chamada de API pra sempre numa restrição que não vai se resolver sozinha.
  const existentesCompletos = new Set();
  const existentesIncompletos = new Set();
  JSON.parse(textoExistentes).forEach((r) => {
    const rankFaltando = (r.rankC === null || r.rankV === null) && !r.rank_indisponivel;
    if (r.chutesC === null || rankFaltando) existentesIncompletos.add(r.fixture_id);
    else existentesCompletos.add(r.fixture_id);
  });
  const novos = fixtures.filter((f) => !existentesCompletos.has(parseInt(f.apiId, 10)));
  console.log('Jogos novos a salvar:', novos.length, '— dos quais reprocessando (dados incompletos):', novos.filter((f) => existentesIncompletos.has(parseInt(f.apiId, 10))).length);

  if (novos.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, mensagem: 'Jogos de hoje já estavam todos salvos e completos.' }) };
  }

  const linhas = [];
  const cacheStandings = new Map();
  const mapaClubes = await buscarMapaClubes(supaUrl, supaServiceKey);
  console.log('Clubes cadastrados na tabela "clubes":', mapaClubes.size);

  for (const f of novos) {
    // 1 chamada extra por jogo NOVO — já traz estatísticas E eventos juntos
    const detalhe = await buscarDetalheDoJogo(apiKey, f.id);

    const casaCorrigido = nomeDoTime(mapaClubes, f.homeTeamId, f.homeTeamName);
    const visCorrigido = nomeDoTime(mapaClubes, f.awayTeamId, f.awayTeamName);

    const { mapa: ranks, indisponivel: rankIndisponivel } = await buscarRanksDaLiga(apiKey, f.leagueId, cacheStandings);
    const gols = extrairGols(detalhe?.events, f.homeTeamName, f.awayTeamName);
    const stats = detalhe?.statistics || [];

    linhas.push({
      fixture_id: parseInt(f.apiId, 10),
      origem: 'goal-api',
      camp: NOMES_CAMP_POR_LIGA.get(f.leagueId),
      data: dataBrParaTexto(f.matchDate),
      rodada: (f.matchRound || '').replace(/^Regular Season - /i, 'Rodada '),
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

  console.log('Resposta Supabase (salvar):', { httpStatus: respSalvar.status });

  if (!respSalvar.ok) {
    const erro = await respSalvar.text();
    console.log('ERRO ao salvar no Supabase:', erro);
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao salvar no Supabase', detalhe: erro }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, jogosSalvos: linhas.length }) };
};
