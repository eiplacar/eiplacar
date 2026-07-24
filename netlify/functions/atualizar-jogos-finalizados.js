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
//   API_FOOTBALL_KEY      → chave da API-Football
//   SUPABASE_URL          → mesma URL do public/js/01-config-auth.js
//   SUPABASE_SERVICE_KEY  → chave "service_role" do Supabase (Settings → API)
//                            NUNCA usar a chave anon aqui — precisa da
//                            service_role pra poder escrever sem estar logado.
// ═══════════════════════════════════════════════════

const NOMES_CAMP_POR_LIGA = new Map([
  [71, 'Brasileirão Série A'],
  [72, 'Brasileirão Série B'],
  [78, 'Bundesliga'],
  [79, 'Bundesliga 2'],
  [39, 'Premier League'],
]);

function dataHojeSaoPaulo() {
  const agora = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(agora); // AAAA-MM-DD
}

function horaAtualSaoPaulo() {
  const agora = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false });
  return parseInt(fmt.format(agora), 10);
}

function dataOntemSaoPaulo() {
  // Pega "agora" já subtraindo 1 dia, e formata do jeito de São Paulo —
  // assim evita bug de fuso horário na virada do dia.
  const agora = new Date();
  agora.setUTCDate(agora.getUTCDate() - 1);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(agora);
}

function dataBrParaTexto(isoDate) {
  const d = new Date(isoDate);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
  return fmt.format(d); // 'en-CA' produz AAAA-MM-DD, formato que o resto do site usa
}

function pegarEstatistica(statsTime, tipo) {
  const item = (statsTime?.statistics || []).find((s) => s.type === tipo);
  const v = item?.value;
  if (v === null || v === undefined) return null;
  return typeof v === 'string' ? parseInt(v, 10) || null : v;
}

// ═══════════════════════════════════════════════════
// CORREÇÃO DE NOMES DE TIMES
// A API-Football manda os nomes sem acento e às vezes com grafia
// diferente da que já está cadastrada no sistema (ex: "Nautico Recife"
// → "Náutico"). Aqui a gente traduz pro nome que já é usado no site,
// pra não duplicar time por causa de acento/grafia diferente.
//
// Lista inicial baseada nos times já cadastrados no banco. Se aparecer
// mais algum time errado, é só me avisar (o log da função mostra o
// nome exato que a API mandou) que eu adiciono aqui.
// ═══════════════════════════════════════════════════
const NOME_TIME_FIXO = new Map([
  ['Nautico Recife', 'Náutico'],
  ['Nautico', 'Náutico'],
  ['Sao Paulo', 'São Paulo'],
  ['Sao Bernardo', 'São Bernardo'],
  ['Atletico Mineiro', 'Atletico-MG'],
  ['Atletico-MG', 'Atletico-MG'],
  ['Athletico Paranaense', 'Athletico-PR'],
  ['Athletico-PR', 'Athletico-PR'],
  ['Atletico Goianiense', 'Atlético-GO'],
  ['Atletico GO', 'Atlético-GO'],
  ['Ceara', 'Ceará'],
  ['Cuiaba', 'Cuiabá'],
  ['Criciuma', 'Criciúma'],
  ['Chapecoense-sc', 'Chapecoense-SC'],
  ['Chapecoense SC', 'Chapecoense-SC'],
  ['Botafogo SP', 'Botafogo-SP'],
]);

function corrigirNomeTime(nome) {
  return NOME_TIME_FIXO.get(nome) || nome;
}

// Brasileirão = temporada é o ano civil. Bundesliga = temporada europeia (ago-mai),
// então antes de julho ainda é a temporada que começou no ano anterior.
function temporadaDaLiga(ligaId) {
  const agora = new Date();
  if (ligaId === 71 || ligaId === 72) return agora.getFullYear();
  const mes = agora.getMonth() + 1;
  return mes >= 7 ? agora.getFullYear() : agora.getFullYear() - 1;
}

// 1 chamada por liga (reaproveitada pra todos os jogos dessa liga nessa rodada da função)
async function buscarRanksDaLiga(apiKey, ligaId, cacheStandings) {
  if (cacheStandings.has(ligaId)) return cacheStandings.get(ligaId);
  const temporada = temporadaDaLiga(ligaId);
  const resp = await fetch(`https://v3.football.api-sports.io/standings?league=${ligaId}&season=${temporada}`, {
    headers: { 'x-apisports-key': apiKey },
  });
  const json = await resp.json();
  const grupos = json.response?.[0]?.league?.standings || [];
  const mapa = new Map();
  grupos.flat().forEach((t) => mapa.set(t.team.name, t.rank));
  cacheStandings.set(ligaId, mapa);
  return mapa;
}

// 1 chamada por jogo novo — pega os gols com o minuto de cada um
async function buscarGolsDoJogo(apiKey, fixtureId, nomeCasa, nomeVis) {
  const resp = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
    headers: { 'x-apisports-key': apiKey },
  });
  const json = await resp.json();
  return (json.response || [])
    .filter((ev) => ev.type === 'Goal')
    .map((ev) => ({
      min: ev.time.elapsed + (ev.time.extra || 0),
      time: ev.team.name === nomeCasa ? 'casa' : ev.team.name === nomeVis ? 'vis' : 'casa',
      nome: ev.team.name,
    }))
    .sort((a, b) => a.min - b.min);
}

export const handler = async function () {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const supaUrl = process.env.SUPABASE_URL;
  const supaServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!apiKey || !supaUrl || !supaServiceKey) {
    console.log('ERRO: faltam variáveis de ambiente', { temApiKey: !!apiKey, temSupaUrl: !!supaUrl, temSupaKey: !!supaServiceKey });
    return { statusCode: 500, body: JSON.stringify({ erro: 'Faltam variáveis de ambiente (API_FOOTBALL_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY)' }) };
  }

  const hoje = dataHojeSaoPaulo();
  const horaAgora = horaAtualSaoPaulo();

  // Só na(s) execução(ões) de madrugada (0h-2h) a gente também confere ontem —
  // pega jogos que terminaram tarde da noite e escaparam da checagem anterior,
  // sem gastar essa chamada extra o dia inteiro à toa.
  const datas = horaAgora < 2 ? [hoje, dataOntemSaoPaulo()] : [hoje];
  console.log('Buscando jogos finalizados para as datas:', datas);

  let todosFixtures = [];
  for (const data of datas) {
    const respFixtures = await fetch(`https://v3.football.api-sports.io/fixtures?date=${data}&status=FT`, {
      headers: { 'x-apisports-key': apiKey },
    });
    const jsonFixtures = await respFixtures.json();
    console.log(`Resposta API-Football (fixtures ${data}):`, { httpStatus: respFixtures.status, totalRecebido: (jsonFixtures.response || []).length, erros: jsonFixtures.errors });
    todosFixtures = todosFixtures.concat(jsonFixtures.response || []);
  }

  const fixtures = todosFixtures.filter((f) => NOMES_CAMP_POR_LIGA.has(f.league?.id));
  console.log('Jogos após filtro de ligas permitidas:', fixtures.length, fixtures.map(f => `${NOMES_CAMP_POR_LIGA.get(f.league?.id)} - ${f.teams?.home?.name} x ${f.teams?.away?.name}`));

  if (fixtures.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, mensagem: 'Nenhum jogo finalizado hoje nos campeonatos escolhidos.' }) };
  }

  // Descobre quais desses jogos já estão salvos, pra não gastar cota de novo
  const idsHoje = fixtures.map((f) => f.fixture.id);
  const respExistentes = await fetch(
    `${supaUrl}/rest/v1/jogos?select=fixture_id&fixture_id=in.(${idsHoje.join(',')})`,
    { headers: { apikey: supaServiceKey, Authorization: `Bearer ${supaServiceKey}` } }
  );
  const textoExistentes = await respExistentes.text();
  console.log('Resposta Supabase (verificação de existentes):', { httpStatus: respExistentes.status, corpo: textoExistentes });

  if (!respExistentes.ok) {
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao consultar jogos existentes no Supabase', detalhe: textoExistentes }) };
  }

  const existentes = new Set(JSON.parse(textoExistentes).map((r) => r.fixture_id));
  const novos = fixtures.filter((f) => !existentes.has(f.fixture.id));
  console.log('Jogos novos a salvar:', novos.length);

  if (novos.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, mensagem: 'Jogos de hoje já estavam todos salvos.' }) };
  }

  const linhas = [];
  const cacheStandings = new Map();
  for (const f of novos) {
    // 1 chamada extra por jogo NOVO (estatísticas) + 1 pros gols — é o preço de ter os dados completos
    const respStats = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${f.fixture.id}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    const jsonStats = await respStats.json();
    const statsCasa = (jsonStats.response || [])[0];
    const statsVis = (jsonStats.response || [])[1];

    const casaCorrigido = corrigirNomeTime(f.teams.home.name);
    const visCorrigido = corrigirNomeTime(f.teams.away.name);

    const ranks = await buscarRanksDaLiga(apiKey, f.league.id, cacheStandings);
    const gols = await buscarGolsDoJogo(apiKey, f.fixture.id, f.teams.home.name, f.teams.away.name);

    linhas.push({
      fixture_id: f.fixture.id,
      origem: 'api-football',
      camp: NOMES_CAMP_POR_LIGA.get(f.league.id),
      data: dataBrParaTexto(f.fixture.date),
      rodada: (f.league.round || '').replace(/^Regular Season - /i, 'Rodada '),
      local: f.fixture.venue?.name || '',
      casa: casaCorrigido,
      vis: visCorrigido,
      gC: f.goals.home,
      gV: f.goals.away,
      rankC: ranks.get(f.teams.home.name) ?? null,
      rankV: ranks.get(f.teams.away.name) ?? null,
      gols,
      golsHT_C: f.score.halftime?.home ?? null,
      golsHT_V: f.score.halftime?.away ?? null,
      chutesC: pegarEstatistica(statsCasa, 'Total Shots'),
      chutesV: pegarEstatistica(statsVis, 'Total Shots'),
      chutesGolC: pegarEstatistica(statsCasa, 'Shots on Goal'),
      chutesGolV: pegarEstatistica(statsVis, 'Shots on Goal'),
      escanteiosC: pegarEstatistica(statsCasa, 'Corner Kicks'),
      escanteiosV: pegarEstatistica(statsVis, 'Corner Kicks'),
      amarelosC: pegarEstatistica(statsCasa, 'Yellow Cards'),
      amarelosV: pegarEstatistica(statsVis, 'Yellow Cards'),
      vermelhosC: pegarEstatistica(statsCasa, 'Red Cards'),
      vermelhosV: pegarEstatistica(statsVis, 'Red Cards'),
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
