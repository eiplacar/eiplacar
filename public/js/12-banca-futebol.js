// ═══════════════════════════════════════════════════
// BANCA (config básica) + ABA FOOTBALL/ESTATÍSTICA — Ligas, Times, Classificação
// ═══════════════════════════════════════════════════
// ══ BANCA — carteira INDIVIDUAL, sincronizada via Supabase (tabela "banca") ══
// Antes disso a Banca era um "pool" compartilhado entre vários membros + organizador
// (com cota, distribuição proporcional de lucro etc). Agora é uma carteira só, do
// usuário que lança as entradas — bem mais simples de entender e usar.
const BP_KEY = 'bancaParticipantes_v2'; // usado só como cache offline de emergência
const BP_VAZIO = { saldo:0, reserva:0, entradas:[], movimentos:[], protecaoAtiva:true, protecaoPct:10 };
let bancaCache = null; // estado em memória, já carregado da nuvem

// Migração automática do modelo antigo (compartilhado) pro novo (individual):
// o saldo do organizador (d.meuSaldo) vira o saldo da carteira. A reserva já
// tinha esse nome e esse papel (proteção), então não precisa migrar.
function migrarBanca(d){
  if(d.saldo===undefined) d.saldo = d.meuSaldo || 0;
  if(d.movimentos===undefined) d.movimentos = [];
  if(d.protecaoAtiva===undefined) d.protecaoAtiva = true;
  if(d.protecaoPct===undefined) d.protecaoPct = 10;
  return d;
}

function bpUrl(filtros){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/banca' + (filtros || '');
}

// Carrega do cache em memória (síncrono, para não travar toda a UI existente)
function bpLoad(){
  if(bancaCache) return bancaCache;
  try {
    return migrarBanca({ ...BP_VAZIO, ...(JSON.parse(localStorage.getItem(BP_KEY)) || {}) });
  } catch { return { ...BP_VAZIO }; }
}

// Salva: atualiza cache local imediatamente (UI fica rápida) e envia para a nuvem em segundo plano
function bpSave(d){
  bancaCache = d;
  localStorage.setItem(BP_KEY, JSON.stringify(d)); // backup local, caso fique offline
  bpSyncNuvem();
}

// Serializa os envios pra nuvem: se dois "bpSave" acontecerem em sequência rápida, o segundo
// não dispara outro fetch em paralelo (o que podia deixar uma resposta antiga chegar por último
// e sobrescrever um salvamento mais novo — fazendo entradas "sumirem"). Em vez disso, marca que
// tem envio pendente e, assim que o atual terminar, reenvia com o estado mais recente do cache.
let bpSyncEmAndamento = false;
let bpSyncPendente = false;
async function bpSyncNuvem(){
  if (!temConfig()) { setBancaSyncStatus('config'); return; }
  if (bpSyncEmAndamento) { bpSyncPendente = true; return; }
  bpSyncEmAndamento = true;
  setBancaSyncStatus('sync');
  const d = bancaCache; // sempre o estado mais atual no momento do envio
  try {
    const res = await fetch(bpUrl('?id=eq.1'), {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id:1, dados:d, updated_at:new Date().toISOString() })
    });
    if (!res.ok) {
      const t = await res.text();
      if (t.includes('does not exist') || t.includes('PGRST205') || t.includes('schema cache')) {
        setSyncStatus('erro', '⚠️ Crie a tabela "banca" no Supabase (veja ⚙️ Configurar)');
        bpSyncEmAndamento = false;
        return;
      }
      throw new Error(t);
    }
    setBancaSyncStatus('ok');
  } catch(e) {
    setBancaSyncStatus('erro');
    toast('❌ Banca não sincronizou com a nuvem: ' + e.message, true);
  }
  bpSyncEmAndamento = false;
  if (bpSyncPendente) { bpSyncPendente = false; bpSyncNuvem(); }
}

// Busca o estado mais recente da nuvem (chamado ao entrar na aba Banca / abrir o app)
async function bpCarregarNuvem(){
  if (!temConfig()) { bancaCache = bpLoad(); return; }
  // Se ainda tem um envio local pendente/em andamento, NÃO sobrescreve o cache com o que
  // tem na nuvem agora (que ainda está desatualizado) — senão a entrada que acabou de ser
  // salva localmente "some" ao navegar rápido demais pra outra aba. Deixa o envio em
  // andamento terminar sozinho, ele já vai deixar a nuvem igual ao local.
  if (bpSyncEmAndamento || bpSyncPendente) return;
  try {
    const res = await fetch(bpUrl('?id=eq.1&select=dados'), { headers: sbHeaders() });
    if (!res.ok) { const t = await res.text(); throw new Error(t); }
    const data = await res.json();
    if (data && data[0] && data[0].dados) {
      bancaCache = migrarBanca({ ...BP_VAZIO, ...data[0].dados });
      localStorage.setItem(BP_KEY, JSON.stringify(bancaCache));
    } else if (!bancaCache) {
      // nenhuma linha ainda na nuvem: usa o que tiver local (se houver) e cria a linha
      bancaCache = (()=>{ try{ return migrarBanca({ ...BP_VAZIO, ...(JSON.parse(localStorage.getItem(BP_KEY))||{}) }); }catch{ return { ...BP_VAZIO }; } })();
    }
  } catch(e) {
    // sem internet ou tabela "banca" ainda não criada: segue com o cache local
    if (!bancaCache) {
      try { bancaCache = migrarBanca({ ...BP_VAZIO, ...(JSON.parse(localStorage.getItem(BP_KEY))||{}) }); }
      catch { bancaCache = { ...BP_VAZIO }; }
    }
  }
}

// ══ FOOTBALL — Ligas / Times / Classificação ══
// "Ligas" reaproveita a mesma fonte de dados da antiga aba Ligas (entradas da Aba Dados).
// "Times" e "Classificação" são calculados automaticamente a partir dos jogos já
// cadastrados na Aba Dados (jogosCache) — nada aqui é digitado manualmente.

function goSubFutebol(t){
  document.querySelectorAll('#page-futebol .sub-tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('#page-futebol .sub-page').forEach(x=>x.classList.remove('active'));
  document.getElementById('stab-'+t).classList.add('active');
  document.getElementById('sp-'+t).classList.add('active');

  if(t==='fligas'){
    const selG = document.getElementById('filtroLigaGlobal');
    if(selG){
      const cur = selG.value;
      const camps = [...new Set(jogosCache.map(j=>j.camp))];
      selG.innerHTML = '<option value="">Todos os campeonatos</option>' + optionsCampeonato(camps, cur);
    }
    renderLigas(); renderTempoGol();
  }
  if(t==='ftimes'){
    const selF = document.getElementById('fTimeFiltroLiga');
    if(selF){
      const cur = selF.value;
      const camps = [...new Set(jogosCache.map(j=>j.camp))];
      selF.innerHTML = '<option value="">Todas as ligas</option>' + optionsCampeonato(camps, cur);
    }
    renderFutebolTimes();
  }
}

// ══ Versão PURA (sem DOM) da tabela de Times — usada pelo componente React
// da aba Estatística: src/components/Estatistica.jsx.
function computeFutebolTimes(busca, camp, local){
  const buscaLower = (busca||'').trim().toLowerCase();
  const base = camp ? jogosCache.filter(j=>j.camp===camp) : jogosCache;
  let nomes = [...new Set([...base.map(j=>j.casa), ...base.map(j=>j.vis)])];
  if(buscaLower) nomes = nomes.filter(n=>n.toLowerCase().includes(buscaLower));
  nomes = sortNatural(nomes);

  const linhasGols   = [0.5,1.5,2.5,3.5,4.5];
  const linhasCantos = [7.5,8.5,9.5,10.5];

  const linhas = nomes.map(nome=>{
    const jogosTime = base.filter(j=>{
      if(local==='casa') return j.casa===nome;
      if(local==='fora') return j.vis===nome;
      return j.casa===nome||j.vis===nome;
    });
    const n = jogosTime.length;
    if(!n) return null;

    const pctGols = linhasGols.map(l=>{
      const bateu = jogosTime.filter(j=>{
        const golsTime = j.casa===nome ? (j.gC||0) : (j.gV||0);
        return golsTime>l;
      }).length;
      return Math.round((bateu/n)*1000)/10;
    });

    const jogosComCantos = jogosTime.filter(j=>j.escanteiosC!=null && j.escanteiosV!=null);
    const nc = jogosComCantos.length;
    const pctCantos = linhasCantos.map(l=>{
      if(!nc) return null;
      const bateu = jogosComCantos.filter(j=>(j.escanteiosC+j.escanteiosV)>l).length;
      return Math.round((bateu/nc)*1000)/10;
    });

    return { nome, n, pctGols, pctCantos };
  }).filter(Boolean);

  return { temJogosCadastrados: jogosCache.length>0, linhas };
}
window.computeFutebolTimes = computeFutebolTimes;

// ── TIMES: tabela comparativa com % de Over de Gols e Over de Cantos, calculados a partir dos jogos já cadastrados ──
function renderFutebolTimes(){
  const wrap = document.getElementById('fTimesLista');
  if(!wrap) return;
  const busca = (document.getElementById('fTimeBusca')?.value||'').trim().toLowerCase();
  const camp  = document.getElementById('fTimeFiltroLiga')?.value||'';
  const local = document.getElementById('fTimeFiltroLocal')?.value||''; // '' geral | 'casa' mandante | 'fora' visitante

  const base = camp ? jogosCache.filter(j=>j.camp===camp) : jogosCache;
  let nomes = [...new Set([...base.map(j=>j.casa), ...base.map(j=>j.vis)])];
  if(busca) nomes = nomes.filter(n=>n.toLowerCase().includes(busca));
  nomes = sortNatural(nomes);

  if(!nomes.length){
    wrap.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--texto2);padding:16px">${jogosCache.length ? 'Nenhum time encontrado.' : 'Nenhum jogo cadastrado ainda na Aba Dados.'}</td></tr>`;
    return;
  }

  const linhasGols   = [0.5,1.5,2.5,3.5,4.5];
  const linhasCantos = [7.5,8.5,9.5,10.5];

  function corPct(p){ return p>=70 ? '#4dd87a' : p>=50 ? 'var(--ouro)' : '#f08060'; }

  const linhasHtml = nomes.map(nome=>{
    const jogosTime = base.filter(j=>{
      if(local==='casa') return j.casa===nome;
      if(local==='fora') return j.vis===nome;
      return j.casa===nome||j.vis===nome;
    });
    const n = jogosTime.length;
    if(!n) return null; // sem jogos nesse filtro (ex: time que só jogou fora), não mostra linha vazia

    const pctGols = linhasGols.map(l=>{
      const bateu = jogosTime.filter(j=>{
        const golsTime = j.casa===nome ? (j.gC||0) : (j.gV||0);
        return golsTime>l;
      }).length;
      return Math.round((bateu/n)*1000)/10;
    });

    // Cantos: total de escanteios da partida (mandante+visitante) — mesma lógica do Mercado de Cantos da Análise.
    // Só entram jogos com dado de escanteios cadastrado (nem todo jogo antigo tem esse campo).
    const jogosComCantos = jogosTime.filter(j=>j.escanteiosC!=null && j.escanteiosV!=null);
    const nc = jogosComCantos.length;
    const pctCantos = linhasCantos.map(l=>{
      if(!nc) return null;
      const bateu = jogosComCantos.filter(j=>(j.escanteiosC+j.escanteiosV)>l).length;
      return Math.round((bateu/nc)*1000)/10;
    });

    const tdsGols = pctGols.map(p=>`<td class="td-c" style="color:${corPct(p)};font-weight:700">${p}%</td>`).join('');
    const tdsCantos = pctCantos.map(p=>`<td class="td-c" style="${p==null?'color:var(--texto2)':'color:'+corPct(p)+';font-weight:700'}">${p==null?'—':p+'%'}</td>`).join('');

    return `<tr>
      <td><strong>${nome}</strong></td>
      <td class="td-c" style="color:var(--texto2)">${n}</td>
      ${tdsGols}
      ${tdsCantos}
    </tr>`;
  }).filter(Boolean);

  wrap.innerHTML = linhasHtml.length ? linhasHtml.join('') : `<tr><td colspan="11" style="text-align:center;color:var(--texto2);padding:16px">Nenhum time com jogos ${local==='casa'?'como mandante':local==='fora'?'como visitante':'cadastrados'} nesse filtro.</td></tr>`;
}

// ── CLASSIFICAÇÃO: tabela calculada a partir dos resultados da liga selecionada (3 pts vitória, 1 pt empate) ──
// ── Zonas de classificação (cores por faixa de posição), específicas de cada liga ──
const CORES_ZONA = {
  azulEscuro:      '#1e3a8a',
  azulClaro:       '#3b82f6',
  vermelhoEscuro:  '#b91c1c',
  vermelhoClaro:   '#f87171',
  amareloOuro:     '#d4af37',
  vermelhoLaranja: '#f97316'
};
const ZONAS_LIGA = {
  brasA: [
    { de:1,  ate:4,  cor:CORES_ZONA.azulEscuro,     label:'Libertadores (Fase de Grupos)' },
    { de:5,  ate:5,  cor:CORES_ZONA.azulClaro,      label:'Libertadores (Qualificação)' },
    { de:6,  ate:11, cor:CORES_ZONA.vermelhoEscuro, label:'Sul-Americana (Fase de Grupos)' },
    { de:17, ate:20, cor:CORES_ZONA.vermelhoClaro,  label:'Rebaixamento — Série B' }
  ],
  brasB: [
    { de:1,  ate:2,  cor:CORES_ZONA.azulEscuro,     label:'Promovido — Série A' },
    { de:3,  ate:6,  cor:CORES_ZONA.vermelhoEscuro, label:'Playoffs de Promoção' },
    { de:17, ate:20, cor:CORES_ZONA.vermelhoClaro,  label:'Rebaixamento — Série C' }
  ],
  bund1: [
    { de:1,  ate:4,  cor:CORES_ZONA.azulEscuro,      label:'Liga dos Campeões (Fase de Liga)' },
    { de:5,  ate:5,  cor:CORES_ZONA.vermelhoEscuro,  label:'Liga Europa (Fase de Liga)' },
    { de:6,  ate:6,  cor:CORES_ZONA.amareloOuro,     label:'Liga Conferência (Qualificação)' },
    { de:16, ate:16, cor:CORES_ZONA.vermelhoClaro,   label:'Playoff de Rebaixamento' },
    { de:17, ate:18, cor:CORES_ZONA.vermelhoLaranja, label:'Rebaixamento — 2. Bundesliga' }
  ],
  bund2: [
    { de:1,  ate:2,  cor:CORES_ZONA.azulEscuro,      label:'Promovido — Bundesliga' },
    { de:3,  ate:3,  cor:CORES_ZONA.azulClaro,       label:'Qualificado (Promoção)' },
    { de:16, ate:16, cor:CORES_ZONA.vermelhoClaro,   label:'Playoff de Rebaixamento' },
    { de:17, ate:18, cor:CORES_ZONA.vermelhoLaranja, label:'Rebaixamento — 3. Liga' }
  ],
  laliga: [
    { de:1,  ate:4,  cor:CORES_ZONA.azulEscuro,     label:'Liga dos Campeões (Fase de Liga)' },
    { de:5,  ate:5,  cor:CORES_ZONA.vermelhoEscuro, label:'Liga Europa (Fase de Liga)' },
    { de:6,  ate:6,  cor:CORES_ZONA.amareloOuro,    label:'Liga Conferência (Qualificação)' },
    { de:18, ate:20, cor:CORES_ZONA.vermelhoClaro,  label:'Rebaixamento — LaLiga2' }
  ],
  premier: [
    { de:1,  ate:4,  cor:CORES_ZONA.azulEscuro,     label:'Liga dos Campeões (Fase de Liga)' },
    { de:5,  ate:5,  cor:CORES_ZONA.vermelhoEscuro, label:'Liga Europa (Fase de Liga)' },
    { de:18, ate:20, cor:CORES_ZONA.vermelhoClaro,  label:'Rebaixamento — Championship' }
  ]
};
function zonasDaLiga(camp){
  const c = (camp||'').toLowerCase();
  if(c.includes('brasileir') && /s[ée]rie\s*b/.test(c)) return ZONAS_LIGA.brasB;
  if(c.includes('brasileir')) return ZONAS_LIGA.brasA;
  if(c.includes('bundesliga') && /\b2\b|2\.|ii\b/.test(c)) return ZONAS_LIGA.bund2;
  if(c.includes('bundesliga')) return ZONAS_LIGA.bund1;
  if(c.includes('la liga')||c.includes('laliga')) return ZONAS_LIGA.laliga;
  if(c.includes('premier')) return ZONAS_LIGA.premier;
  return null;
}
function zonaPosicao(camp, pos){
  if(pos==null) return null;
  const zonas = zonasDaLiga(camp);
  if(!zonas) return null;
  return zonas.find(z=>pos>=z.de && pos<=z.ate) || null;
}

// ══ Versão PURA (sem DOM) da Classificação — usada pelo componente React
// da aba Classificação: src/components/Classificacao.jsx.
function computeClassificacao(camp){
  if(/copa do mundo|amistoso/i.test(camp)) return { estado:'sem-classificacao', camp };

  const jogos = camp ? jogosCache.filter(j=>j.camp===camp) : [];
  if(!jogos.length) return { estado: jogosCache.length ? 'sem-jogos-liga' : 'sem-jogos', camp };

  const jogosOrdenados = [...jogos].sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  const rankPorTime = {};
  jogosOrdenados.forEach(j=>{
    if(j.rankC!=null) rankPorTime[j.casa] = j.rankC;
    if(j.rankV!=null) rankPorTime[j.vis]  = j.rankV;
  });

  const tab = {};
  function linhaTime(nome){ return tab[nome] || (tab[nome] = {j:0,v:0,e:0,d:0,gp:0,gc:0}); }
  jogos.forEach(j=>{
    const c = linhaTime(j.casa), v = linhaTime(j.vis);
    c.j++; v.j++;
    c.gp += (j.gC||0); c.gc += (j.gV||0);
    v.gp += (j.gV||0); v.gc += (j.gC||0);
    if(j.gC>j.gV){ c.v++; v.d++; }
    else if(j.gC<j.gV){ v.v++; c.d++; }
    else { c.e++; v.e++; }
  });

  const linhas = Object.keys(tab).map(nome=>{
    const t = tab[nome];
    const pts = t.v*3 + t.e;
    const rank = rankPorTime[nome] ?? null;
    const zona = zonaPosicao(camp, rank);
    return { nome, pts, ...t, sg: t.gp-t.gc, rank, zona };
  }).sort((a,b)=>{
    const chaveA = a.rank!=null ? a.rank : (100000-a.pts);
    const chaveB = b.rank!=null ? b.rank : (100000-b.pts);
    if(chaveA!==chaveB) return chaveA-chaveB;
    return b.sg-a.sg;
  });

  return { estado:'ok', camp, linhas, zonas: zonasDaLiga(camp) };
}
window.computeClassificacao = computeClassificacao;

function renderFutebolClassificacao(){
  const body = document.getElementById('fClassBody');
  const legenda = document.getElementById('fClassLegenda');
  if(!body) return;
  const camp = document.getElementById('fClassLiga')?.value||'';

  // Copa do Mundo e Amistosos não têm tabela de classificação
  if(/copa do mundo|amistoso/i.test(camp)){
    body.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--texto2);padding:16px">${camp} não tem classificação (mata-mata/amistoso).</td></tr>`;
    if(legenda) legenda.innerHTML = '';
    return;
  }

  const jogos = camp ? jogosCache.filter(j=>j.camp===camp) : [];
  if(!jogos.length){
    body.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--texto2);padding:16px">${jogosCache.length ? 'Nenhum jogo dessa liga na Aba Dados ainda.' : 'Nenhum jogo cadastrado ainda na Aba Dados.'}</td></tr>`;
    if(legenda) legenda.innerHTML = '';
    return;
  }

  // Ranking já informado em cada jogo (o mais recente por time) — essa É a classificação real da liga
  const jogosOrdenados = [...jogos].sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  const rankPorTime = {};
  jogosOrdenados.forEach(j=>{
    if(j.rankC!=null) rankPorTime[j.casa] = j.rankC;
    if(j.rankV!=null) rankPorTime[j.vis]  = j.rankV;
  });

  // V/E/D/GP/GC/Pts calculados a partir dos resultados — servem de apoio e de fallback pra quem não tem ranking
  const tab = {}; // nome -> {j,v,e,d,gp,gc}
  function linhaTime(nome){ return tab[nome] || (tab[nome] = {j:0,v:0,e:0,d:0,gp:0,gc:0}); }
  jogos.forEach(j=>{
    const c = linhaTime(j.casa), v = linhaTime(j.vis);
    c.j++; v.j++;
    c.gp += (j.gC||0); c.gc += (j.gV||0);
    v.gp += (j.gV||0); v.gc += (j.gC||0);
    if(j.gC>j.gV){ c.v++; v.d++; }
    else if(j.gC<j.gV){ v.v++; c.d++; }
    else { c.e++; v.e++; }
  });

  const linhas = Object.keys(tab).map(nome=>{
    const t = tab[nome];
    const pts = t.v*3 + t.e;
    const rank = rankPorTime[nome] ?? null;
    return { nome, pts, ...t, sg: t.gp-t.gc, rank };
  }).sort((a,b)=>{
    // Time com ranking informado usa a posição real; sem ranking, cai pro padrão por pontos (fica depois dos ranqueados)
    const chaveA = a.rank!=null ? a.rank : (100000-a.pts);
    const chaveB = b.rank!=null ? b.rank : (100000-b.pts);
    if(chaveA!==chaveB) return chaveA-chaveB;
    return b.sg-a.sg;
  });

  body.innerHTML = linhas.map(l=>{
    const zona = zonaPosicao(camp, l.rank);
    const estiloPos = zona ? `box-shadow:inset 4px 0 0 0 ${zona.cor};` : '';
    return `<tr>
    <td style="${estiloPos}" title="${zona?zona.label:''}">${l.rank ?? '—'}</td>
    <td style="text-align:left">${l.nome}</td>
    <td><strong>${l.pts}</strong></td>
    <td>${l.j}</td>
    <td>${l.v}</td>
    <td>${l.e}</td>
    <td>${l.d}</td>
    <td>${l.gp}</td>
    <td>${l.gc}</td>
    <td style="color:${l.sg>=0?'#4dd87a':'#f08060'}">${l.sg>=0?'+':''}${l.sg}</td>
  </tr>`;
  }).join('');

  // Legenda das zonas dessa liga
  if(legenda){
    const zonas = zonasDaLiga(camp);
    legenda.innerHTML = zonas ? zonas.map(z=>`
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--texto2)">
        <span style="width:10px;height:10px;border-radius:3px;background:${z.cor};flex-shrink:0"></span>
        <span>${z.label}</span>
      </div>`).join('') : '';
  }
}

function setBancaSyncStatus(estado){
  // reaproveita o mesmo indicador de sincronização do topo

  if (estado==='ok')     setSyncStatus('ok', '☁️ Banca sincronizada');
  if (estado==='sync')   setSyncStatus('sync', 'Sincronizando banca...');
  if (estado==='erro')   setSyncStatus('erro', 'Erro ao sincronizar a banca');
  if (estado==='config') setSyncStatus('config', 'Sem conexão com o banco de dados');
}

// (as antigas saldoParticipante/plParticipante/totalSaldos/cotaAtual/roiParticipante
// foram removidas — não fazem mais sentido numa carteira individual. O que elas
// calculavam agora vem de window.computeCarteira(), em 14-banca-gestao.js.)

