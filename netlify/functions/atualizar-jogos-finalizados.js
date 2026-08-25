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

// Faz até `limite` chamadas ao mesmo tempo (não todas de uma vez, não uma de cada vez).
// Testamos os dois extremos: tudo em série estourava o tempo limite da função (12 ligas
// x ~15s = 180s+); tudo de uma vez batia rate limit da GOAL API (429 em quase todas).
// Um meio-termo de poucas por vez resolve os dois problemas. Além disso, se ainda vier
// 429 (rajada momentânea), espera um pouco e tenta de novo (até 2 vezes) antes de desistir
// dessa chamada — a maioria dos rate limits de rajada libera sozinho em 1-2 segundos.
async function buscarComLimite(items, limite, fn) {
  const resultados = [];
  for (let i = 0; i < items.length; i += limite) {
    const lote = items.slice(i, i + limite);
    const parcial = await Promise.all(lote.map(fn));
    resultados.push(...parcial);
  }
  return resultados;
}
async function fetchComRetry429(url, opts, tentativas = 3, esperaMs = 1500) {
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const resp = await fetch(url, opts);
    if (resp.status !== 429) return resp;
    if (tentativa < tentativas) await new Promise((r) => setTimeout(r, esperaMs * tentativa));
  }
  return fetch(url, opts); // última tentativa, devolve o que vier (mesmo que 429 de novo)
}

// IDs das ligas na GOAL API → nome do campeonato que aparece no app.
// Mesma lista de 10 ligas usada em jogos-do-dia.js.
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

// País de cada liga — mapeado pelo ID (não pelo nome), então não tem como dar
// ambiguidade entre "Série A" do Brasil e "Serie A" da Itália: são IDs diferentes
// na API, cada um com o país já sabido de antemão (ver comentário acima).
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

// A GOAL API manda "matchDate" pareado com "matchTime" em UTC (confirmado na correção
// de jogos-do-dia.js). Só repassar matchDate direto (como fazia antes) dá bug pra jogos
// que caem de madrugada em UTC mas ainda são "hoje à noite" no horário local — típico de
// jogos da Liga MX às 22h (México), que em UTC já viram madrugada do dia seguinte.
// Por isso aqui juntamos matchDate+matchTime num timestamp UTC de verdade e extraímos a
// data já no fuso de São Paulo — a mesma data que aparece pro usuário em "Jogos do Dia".
function dataBrParaTexto(matchDate, matchTime) {
  if (!matchDate) return matchDate;
  if (!matchTime) return matchDate; // sem horário, não dá pra converter — mantém como veio
  const dt = new Date(`${matchDate}T${matchTime}:00Z`);
  if (Number.isNaN(dt.getTime())) return matchDate;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(dt);
}

// A GOAL API manda "matchRound" como número puro (ex: "21"), diferente da
// API-Football que mandava um texto tipo "Regular Season - 21". Se vier só
// número, adiciona o "Rodada " na frente; se já vier outro texto (grupos,
// fases eliminatórias etc.), deixa como está.
function formatarRodada(matchRound) {
  const bruto = (matchRound || '').toString().trim();
  if (!bruto) return '';
  return /^\d+$/.test(bruto) ? `Rodada ${bruto}` : bruto;
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

// "45", "90+3" etc. — devolve o minuto-BASE e o acréscimo SEPARADOS (não soma).
// BUG que isso corrige: antes somava tudo ("45+3" → 48), e como todo o motor de análise
// usa min<=45 pra decidir "esse gol foi no 1º tempo" (estatísticas de HT, faixas de
// minuto etc.), um gol nos acréscimos do 1º tempo (ex: 45+3) virava min=48 e passava a
// contar (errado) como gol do 2º tempo em tudo. Com min=45 e acr=3 separados, o gol
// continua corretamente classificado como 1º tempo, e o "+3" fica só pra exibição.
function parseMinuto(tempo) {
  if (!tempo) return { min: 0, acr: 0 };
  const [base, extra] = String(tempo).split('+');
  const min = parseInt(base, 10) || 0;
  const acr = extra ? (parseInt(extra, 10) || 0) : 0;
  return { min, acr };
}

// Os eventos da GOAL API não trazem o nome do time que fez o gol — só
// indicam o lado (homeScorer preenchido = gol da casa; awayScorer = visitante).
function extrairGols(eventos, nomeCasa, nomeVis) {
  return (eventos || [])
    .filter((ev) => ev.type === 'GOAL')
    .map((ev) => {
      const daCasa = !!ev.homeScorer;
      const { min, acr } = parseMinuto(ev.time);
      return {
        min, acr,
        time: daCasa ? 'casa' : 'vis',
        nome: daCasa ? nomeCasa : nomeVis,
      };
    })
    .sort((a, b) => (a.min + a.acr) - (b.min + b.acr));
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

  const resp = await fetchComRetry429(`${GOAL_API_URL}/leagues/${ligaId}/standings`, {
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
  const resp = await fetchComRetry429(`${GOAL_API_URL}/fixtures/${fixtureId}`, {
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
  //
  // Removido o "&status=FINISHED" da URL: como só tínhamos visto jogos do passado
  // (que são finalizados de qualquer jeito, com ou sem filtro), não dava pra saber
  // se esse parâmetro realmente filtra alguma coisa na API. Agora buscamos tudo
  // (agendado, ao vivo, finalizado) e conferimos o status aqui no código — mais
  // seguro e também deixa ver o status real dos jogos de hoje que ainda não bateram.
  //
  // Em PARALELO total já bateu rate limit 429 da GOAL API (12 chamadas ao mesmo tempo é
  // demais pra ela), e em SÉRIE (uma de cada vez) passava de 60s e a função era morta no
  // meio do loop, deixando de fora as ligas de trás. Solução: lotes de 3 ao mesmo tempo
  // (ver buscarComLimite acima), com nova tentativa automática se ainda bater 429.
  const respostasPorLiga = await buscarComLimite([...NOMES_CAMP_POR_LIGA.keys()], 3, async (ligaId) => {
    try {
      const resp = await fetchComRetry429(`${GOAL_API_URL}/fixtures?leagueId=${ligaId}&limit=30`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json = await resp.json();
      return { ligaId, httpStatus: resp.status, json };
    } catch (e) {
      console.log(`ERRO ao buscar fixtures da liga=${ligaId}:`, e.message);
      return { ligaId, httpStatus: 0, json: { success: false, data: [] } };
    }
  });

  let todosFixtures = [];
  for (const { ligaId, httpStatus, json } of respostasPorLiga) {
    const dados = json.data || [];
    console.log(`Resposta GOAL API (fixtures liga=${ligaId}):`, { httpStatus, success: json.success, totalRecebido: dados.length });
    // DIAGNÓSTICO — mostra só os jogos com matchDate de hoje/ontem, com o status
    // e horário exatos que a API está reportando pra eles agora.
    const doDia = dados.filter((f) => datasValidas.has(f.matchDate));
    if (doDia.length) {
      console.log(`  ↳ Jogos de hoje/ontem nessa liga (${doDia.length}):`, doDia.map((f) => ({ jogo: `${f.homeTeamName} x ${f.awayTeamName}`, matchDate: f.matchDate, matchTime: f.matchTime, matchStatus: f.matchStatus, matchLive: f.matchLive, placar: `${f.homeTeamScore}-${f.awayTeamScore}` })));
    }
    if (!json.success) continue;
    todosFixtures = todosFixtures.concat(dados);
  }

  const fixtures = todosFixtures.filter((f) => NOMES_CAMP_POR_LIGA.has(f.leagueId) && datasValidas.has(f.matchDate) && f.matchStatus === 'FINISHED');
  console.log('Jogos após filtro de ligas permitidas + finalizados:', fixtures.length, fixtures.map((f) => `${NOMES_CAMP_POR_LIGA.get(f.leagueId)} - ${f.homeTeamName} x ${f.awayTeamName}`));

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

  // Mesma lógica de limitar concorrência aplicada aqui: primeiro busca a classificação de
  // cada liga envolvida (lotes de 3, 1 chamada por liga — sem duplicar graças ao
  // cacheStandings), só DEPOIS os detalhes de cada jogo (lotes de 3) — sem corrida no
  // cache porque as classificações já foram todas buscadas e guardadas antes desse passo.
  const ligasEnvolvidas = [...new Set(novos.map((f) => f.leagueId))];
  await buscarComLimite(ligasEnvolvidas, 3, (ligaId) => buscarRanksDaLiga(apiKey, ligaId, cacheStandings));

  const detalhesPorJogo = await buscarComLimite(novos, 3, async (f) => {
    try {
      const detalhe = await buscarDetalheDoJogo(apiKey, f.id);
      return { f, detalhe };
    } catch (e) {
      console.log(`ERRO ao buscar detalhe do jogo id=${f.id}:`, e.message);
      return { f, detalhe: null };
    }
  });

  for (const { f, detalhe } of detalhesPorJogo) {
    const casaCorrigido = nomeDoTime(mapaClubes, f.homeTeamId, f.homeTeamName);
    const visCorrigido = nomeDoTime(mapaClubes, f.awayTeamId, f.awayTeamName);

    const { mapa: ranks, indisponivel: rankIndisponivel } = await buscarRanksDaLiga(apiKey, f.leagueId, cacheStandings);
    const gols = extrairGols(detalhe?.events, f.homeTeamName, f.awayTeamName);
    const stats = detalhe?.statistics || [];

    linhas.push({
      fixture_id: parseInt(f.apiId, 10),
      origem: 'goal-api',
      camp: NOMES_CAMP_POR_LIGA.get(f.leagueId),
      pais: PAIS_POR_LIGA.get(f.leagueId),
      data: dataBrParaTexto(f.matchDate, f.matchTime),
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

  console.log('Resposta Supabase (salvar):', { httpStatus: respSalvar.status });

  if (!respSalvar.ok) {
    const erro = await respSalvar.text();
    console.log('ERRO ao salvar no Supabase:', erro);
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao salvar no Supabase', detalhe: erro }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, jogosSalvos: linhas.length }) };
};
