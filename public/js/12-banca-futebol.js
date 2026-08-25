// ═══════════════════════════════════════════════════
// BANCA (config básica) + ABA FOOTBALL/ESTATÍSTICA — Ligas, Times, Classificação
// ═══════════════════════════════════════════════════
// ══ BANCA — carteira INDIVIDUAL, sincronizada via Supabase (tabela "banca") ══
// Antes disso a Banca era um "pool" compartilhado entre vários membros + organizador
// (com cota, distribuição proporcional de lucro etc). Agora é uma carteira só, do
// usuário que lança as entradas — bem mais simples de entender e usar.
const BP_KEY_BASE = 'bancaParticipantes_v2'; // usado só como cache offline de emergência
function bpLocalKey(){
  const uid = bpUserId();
  return BP_KEY_BASE + (uid ? '_' + uid : '_anon');
}
const BP_VAZIO = { saldo:0, reserva:0, entradas:[], movimentos:[], protecaoAtiva:true, protecaoPct:10, metaDiaria:0, stopGain:0, stopLoss:0 };
let bancaCache = null; // estado em memória, já carregado da nuvem

// Migração automática do modelo antigo (compartilhado) pro novo (individual):
// o saldo do organizador (d.meuSaldo) vira o saldo da carteira. A reserva já
// tinha esse nome e esse papel (proteção), então não precisa migrar.
function migrarBanca(d){
  if(d.saldo===undefined) d.saldo = d.meuSaldo || 0;
  if(d.movimentos===undefined) d.movimentos = [];
  if(d.protecaoAtiva===undefined) d.protecaoAtiva = true;
  if(d.protecaoPct===undefined) d.protecaoPct = 10;
  if(d.metaDiaria===undefined) d.metaDiaria = 0;
  if(d.stopLoss===undefined) d.stopLoss = d.stopDiario!==undefined ? d.stopDiario : 0; // migra campo antigo "stopDiario"
  if(d.stopGain===undefined) d.stopGain = 0;
  return d;
}

function bpUrl(filtros){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/banca' + (filtros || '');
}

// A carteira agora é filtrada pelo usuário logado (antes usava sempre "id=eq.1",
// uma linha ÚNICA pro app inteiro — por isso todo mundo via a mesma banca,
// "espelhada" com a do organizador). Sem usuário logado, não tem carteira pra buscar.
function bpUserId(){
  return (typeof perfilAtual !== 'undefined' && perfilAtual && perfilAtual.id) || null;
}

// Carrega do cache em memória (síncrono, para não travar toda a UI existente)
function bpLoad(){
  if(bancaCache) return bancaCache;
  try {
    return migrarBanca({ ...BP_VAZIO, ...(JSON.parse(localStorage.getItem(bpLocalKey())) || {}) });
  } catch { return { ...BP_VAZIO }; }
}

// Salva: atualiza cache local imediatamente (UI fica rápida) e envia para a nuvem em segundo plano
function bpSave(d){
  bancaCache = d;
  // Backup local, caso fique offline — se o localStorage estiver cheio, ignora e segue
  // só com a nuvem (que é a fonte de verdade mesmo); sem o try/catch, isso travava a
  // tela com um erro de "quota exceeded" no meio do uso normal do app.
  try { localStorage.setItem(bpLocalKey(), JSON.stringify(d)); } catch(e){ console.error('Backup local da Banca falhou (sem espaço no navegador):', e); }
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
  const uid = bpUserId();
  if (!uid) { setBancaSyncStatus('config'); return; } // ninguém logado ainda, nada pra sincronizar
  if (bpSyncEmAndamento) { bpSyncPendente = true; return; }
  bpSyncEmAndamento = true;
  setBancaSyncStatus('sync');
  const d = bancaCache; // sempre o estado mais atual no momento do envio
  try {
    const res = await fetch(bpUrl('?on_conflict=user_id'), {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id:uid, dados:d, updated_at:new Date().toISOString() })
    });
    if (!res.ok) {
      const t = await res.text();
      if (t.includes('does not exist') || t.includes('PGRST205') || t.includes('schema cache')) {
        setSyncStatus('erro', 'Crie a tabela "banca" no Supabase (veja Configurar)');
        bpSyncEmAndamento = false;
        return;
      }
      throw new Error(t);
    }
    setBancaSyncStatus('ok');
  } catch(e) {
    setBancaSyncStatus('erro');
    toast('Banca não sincronizou com a nuvem: ' + e.message, true);
  }
  bpSyncEmAndamento = false;
  if (bpSyncPendente) { bpSyncPendente = false; bpSyncNuvem(); }
}

// Busca o estado mais recente da nuvem (chamado ao entrar na aba Banca / abrir o app).
//
// CAUSA DA DEMORA (investigado): antes disso, TODA vez que a pessoa clicava na aba
// Banca, o app disparava um fetch novo pro Supabase e só atualizava a tela quando a
// resposta chegava — em conexão lenta/instável isso trava a exibição por 1-3s+ a cada
// clique, mesmo que os dados não tenham mudado desde a última vez. Agora: só busca de
// novo se já passou BP_THROTTLE_MS desde a última busca (ou se `force=true`, usado
// depois de salvar/editar/excluir uma movimentação). A tela já mostra o cache local
// na hora — a busca na nuvem só confirma/atualiza em segundo plano.
const BP_THROTTLE_MS = 15000;
let bpUltimaBuscaEm = 0;
async function bpCarregarNuvem(force){
  const uid = bpUserId();
  if (!uid || !temConfig()) { bancaCache = bpLoad(); return; }
  if (!force && (Date.now() - bpUltimaBuscaEm) < BP_THROTTLE_MS) return; // cache ainda "fresco", evita round-trip desnecessário
  // Se ainda tem um envio local pendente/em andamento, NÃO sobrescreve o cache com o que
  // tem na nuvem agora (que ainda está desatualizado) — senão a entrada que acabou de ser
  // salva localmente "some" ao navegar rápido demais pra outra aba. Deixa o envio em
  // andamento terminar sozinho, ele já vai deixar a nuvem igual ao local.
  if (bpSyncEmAndamento || bpSyncPendente) return;
  try {
    const res = await fetch(bpUrl('?user_id=eq.'+uid+'&select=dados'), { headers: sbHeaders() });
    if (!res.ok) { const t = await res.text(); throw new Error(t); }
    const data = await res.json();
    bpUltimaBuscaEm = Date.now();
    if (data && data[0] && data[0].dados) {
      bancaCache = migrarBanca({ ...BP_VAZIO, ...data[0].dados });
      localStorage.setItem(bpLocalKey(), JSON.stringify(bancaCache));
    } else if (!bancaCache) {
      // nenhuma linha ainda na nuvem: usa o que tiver local (se houver) e cria a linha
      bancaCache = (()=>{ try{ return migrarBanca({ ...BP_VAZIO, ...(JSON.parse(localStorage.getItem(bpLocalKey()))||{}) }); }catch{ return { ...BP_VAZIO }; } })();
    }
  } catch(e) {
    // sem internet ou tabela "banca" ainda não criada: segue com o cache local
    if (!bancaCache) {
      try { bancaCache = migrarBanca({ ...BP_VAZIO, ...(JSON.parse(localStorage.getItem(bpLocalKey()))||{}) }); }
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

  const linhasGols    = [0.5,1.5,2.5,3.5,4.5];
  const linhasCantos  = [6.5,7.5,8.5,9.5,10.5,11.5];
  const linhasCartoes = [1.5,2.5,3.5,4.5,5.5,6.5];

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

    const bttsBateu = jogosTime.filter(j=>(j.gC||0)>0 && (j.gV||0)>0).length;
    const pctBTTS = Math.round((bttsBateu/n)*1000)/10;

    const jogosComCantos = jogosTime.filter(j=>j.escanteiosC!=null && j.escanteiosV!=null);
    const nc = jogosComCantos.length;
    const pctCantos = linhasCantos.map(l=>{
      if(!nc) return null;
      const bateu = jogosComCantos.filter(j=>(j.escanteiosC+j.escanteiosV)>l).length;
      return Math.round((bateu/nc)*1000)/10;
    });

    const jogosComCartoes = jogosTime.filter(j=>j.amarelosC!=null && j.amarelosV!=null);
    const ncart = jogosComCartoes.length;
    const pctCartoes = linhasCartoes.map(l=>{
      if(!ncart) return null;
      const bateu = jogosComCartoes.filter(j=>((j.amarelosC||0)+(j.amarelosV||0)+(j.vermelhosC||0)+(j.vermelhosV||0))>l).length;
      return Math.round((bateu/ncart)*1000)/10;
    });

    return { nome, n, pctGols, pctBTTS, pctCantos, nCantos: nc, pctCartoes, nCartoes: ncart };
  }).filter(Boolean);

  return { temJogosCadastrados: jogosCache.length>0, linhas };
}
window.computeFutebolTimes = computeFutebolTimes;

// ══ Versão PURA (sem DOM) da tabela de Ligas — usada pelo componente React
// da aba Estatística: src/components/Estatistica.jsx.
// (Faltava esta função: o componente já chamava window.computeFutebolLigas,
// mas ela nunca tinha sido criada — por isso o seletor "Ligas" nunca mostrava
// dados, mesmo com jogos cadastrados. Mesma lógica de computeFutebolTimes,
// só que agrupando por campeonato em vez de por time.)
function computeFutebolLigas(busca, filtroCamp){
  const buscaLower = (busca||'').trim().toLowerCase();
  let camps = filtroCamp ? [filtroCamp] : [...new Set(jogosCache.map(j=>j.camp))];
  if(buscaLower) camps = camps.filter(c=>c.toLowerCase().includes(buscaLower));
  camps = sortNatural(camps);

  const linhasGols    = [0.5,1.5,2.5,3.5,4.5];
  const linhasCantos  = [6.5,7.5,8.5,9.5,10.5,11.5];
  const linhasCartoes = [1.5,2.5,3.5,4.5,5.5,6.5];

  const linhas = camps.map(camp=>{
    const jogosLiga = jogosCache.filter(j=>j.camp===camp);
    const n = jogosLiga.length;
    if(!n) return null;

    const pctGols = linhasGols.map(l=>{
      const bateu = jogosLiga.filter(j=>((j.gC||0)+(j.gV||0))>l).length;
      return Math.round((bateu/n)*1000)/10;
    });

    const bttsBateu = jogosLiga.filter(j=>(j.gC||0)>0 && (j.gV||0)>0).length;
    const pctBTTS = Math.round((bttsBateu/n)*1000)/10;

    const jogosComCantos = jogosLiga.filter(j=>j.escanteiosC!=null && j.escanteiosV!=null);
    const nc = jogosComCantos.length;
    const pctCantos = linhasCantos.map(l=>{
      if(!nc) return null;
      const bateu = jogosComCantos.filter(j=>(j.escanteiosC+j.escanteiosV)>l).length;
      return Math.round((bateu/nc)*1000)/10;
    });

    const jogosComCartoes = jogosLiga.filter(j=>j.amarelosC!=null && j.amarelosV!=null);
    const ncart = jogosComCartoes.length;
    const pctCartoes = linhasCartoes.map(l=>{
      if(!ncart) return null;
      const bateu = jogosComCartoes.filter(j=>((j.amarelosC||0)+(j.amarelosV||0)+(j.vermelhosC||0)+(j.vermelhosV||0))>l).length;
      return Math.round((bateu/ncart)*1000)/10;
    });

    return { nome: camp, n, pctGols, pctBTTS, pctCantos, nCantos: nc, pctCartoes, nCartoes: ncart };
  }).filter(Boolean);

  return { temJogosCadastrados: jogosCache.length>0, linhas };
}
window.computeFutebolLigas = computeFutebolLigas;

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
  vermelhoLaranja: '#f97316',
  vermelhoVinho:   '#7c1836',
  vermelho:        '#dc2626'
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
    { de:1,  ate:4,  cor:CORES_ZONA.azulEscuro,     label:'Qualificado - Liga dos Campeões (Fase de Liga)' },
    { de:5,  ate:5,  cor:CORES_ZONA.vermelhoVinho,  label:'Qualificado - Liga Europa (Fase de Liga)' },
    { de:18, ate:20, cor:CORES_ZONA.vermelhoClaro,  label:'Despromoção - Championship' }
  ],
  portugal: [ // Primeira Liga
    { de:1,  ate:2,  cor:CORES_ZONA.azulEscuro,      label:'Liga dos Campeões (Fase de Liga)' },
    { de:3,  ate:3,  cor:CORES_ZONA.azulClaro,       label:'Liga dos Campeões (Qualificação)' },
    { de:4,  ate:4,  cor:CORES_ZONA.vermelhoEscuro,  label:'Liga Europa (Qualificação)' },
    { de:5,  ate:5,  cor:CORES_ZONA.amareloOuro,     label:'Liga Conferência (Qualificação)' },
    { de:16, ate:16, cor:CORES_ZONA.vermelhoClaro,   label:'Liga Portugal Betclic (Despromoção)' },
    { de:17, ate:18, cor:CORES_ZONA.vermelhoLaranja, label:'Despromoção — Liga Portugal 2' }
  ],
  mexico: [ // Liga MX
    { de:1,  ate:8,  cor:CORES_ZONA.azulEscuro, label:'Liga MX (Abertura — Playoffs: Quartas de final)' }
  ],
  ligue1: [ // França
    { de:1,  ate:3,  cor:CORES_ZONA.azulEscuro,    label:'Qualificado - Liga dos Campeões (Fase de Liga)' },
    { de:4,  ate:4,  cor:CORES_ZONA.azulClaro,     label:'Qualificado - Liga dos Campeões (Qualificação)' },
    { de:5,  ate:5,  cor:CORES_ZONA.vermelhoVinho, label:'Qualificado - Liga Europa (Fase de Liga)' },
    { de:6,  ate:6,  cor:CORES_ZONA.amareloOuro,   label:'Qualificado - Liga Conferência (Qualificação)' },
    { de:16, ate:16, cor:CORES_ZONA.vermelho,      label:'Playoff de Rebaixamento' },
    { de:17, ate:18, cor:CORES_ZONA.vermelhoClaro, label:'Despromoção - Liga 2' }
  ],
  serieA: [ // Itália
    { de:1,  ate:4,  cor:CORES_ZONA.azulEscuro,    label:'Qualificado - Liga dos Campeões (Fase de Liga)' },
    { de:5,  ate:5,  cor:CORES_ZONA.vermelhoVinho, label:'Qualificado - Liga Europa (Fase de Liga)' },
    { de:6,  ate:6,  cor:CORES_ZONA.amareloOuro,   label:'Qualificado - Liga Conferência (Qualificação)' },
    { de:18, ate:20, cor:CORES_ZONA.vermelhoClaro, label:'Despromoção - Série B' }
  ],
  holanda: [ // Eredivisie
    { de:1,  ate:1,  cor:CORES_ZONA.azulEscuro,    label:'Qualificado - Liga dos Campeões (Fase da Liga)' },
    { de:2,  ate:2,  cor:CORES_ZONA.azulClaro,     label:'Qualificado - Liga dos Campeões (Qualificação)' },
    { de:3,  ate:3,  cor:CORES_ZONA.vermelhoVinho, label:'Qualificado - Liga Europa (Qualificação)' },
    { de:4,  ate:7,  cor:CORES_ZONA.amareloOuro,   label:'Qualificado - Eredivisie (Liga da Conferência - Playoffs)' },
    { de:16, ate:16, cor:CORES_ZONA.vermelho,      label:'Eredivisie (Playoff de Rebaixamento)' },
    { de:17, ate:18, cor:CORES_ZONA.vermelhoClaro, label:'Despromoção - Eerste Divisie' }
  ],
  // UEFA Champions League — só a Fase da Liga (tabela única, 36 times) tem posição
  // pra colorir. Qualificação (antes) e Playoffs/mata-mata (depois) não têm "posição",
  // são chaveamento — por isso não entram aqui (zonaPosicao() já retorna null sozinho
  // pra jogo sem rank, então essas fases simplesmente ficam sem cor, sem quebrar nada).
  championsLeague: [
    { de:1,  ate:8,  cor:CORES_ZONA.azulEscuro, label:'Qualificado - Liga dos Campeões (Playoffs: Oitavas de Final)' },
    { de:9,  ate:24, cor:CORES_ZONA.azulClaro,  label:'Qualificado - Liga dos Campeões (Playoffs: 16 Avos de Final)' }
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
  if(c.includes('primeira liga')) return ZONAS_LIGA.portugal;
  if(c.includes('liga mx')) return ZONAS_LIGA.mexico;
  if(c.includes('ligue 1')) return ZONAS_LIGA.ligue1;
  if(c.includes('serie a') && !c.includes('brasileir')) return ZONAS_LIGA.serieA;
  if(c.includes('eredivisie')) return ZONAS_LIGA.holanda;
  if(c.includes('champions league')) return ZONAS_LIGA.championsLeague;
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

// Critérios OFICIAIS de desempate do Campeonato Brasileiro (Série A e Série B),
// usados como cálculo manual sempre que a API-Football não entregar o rank
// (hoje isso é sempre, por causa da restrição do plano gratuito — ver
// rank_indisponivel em netlify/functions/atualizar-jogos-finalizados.js):
//   1) maior número de pontos
//   2) maior número de vitórias
//   3) maior saldo de gols
//   4) maior número de gols marcados
//   5) confronto direto — só entra em jogo quando o empate (nos 4 critérios
//      acima) é entre EXATAMENTE dois clubes; com 3+ empatados, pula direto
//      pro critério 6
//   6) menor número de cartões vermelhos
//   7) menor número de cartões amarelos
function ordenarBrasileirao(linhas, jogos){
  const porCartoes = (a,b) => a.vermelhos!==b.vermelhos ? a.vermelhos-b.vermelhos : a.amarelos-b.amarelos;

  // Agrupa quem empatou nos critérios 1-4 (pts, vitórias, saldo, gols marcados)
  const porChave = new Map();
  linhas.forEach(l=>{
    const k = `${l.pts}|${l.v}|${l.sg}|${l.gp}`;
    (porChave.get(k) || porChave.set(k, []).get(k)).push(l);
  });

  const grupos = [...porChave.values()].sort((a,b)=>{
    const x=a[0], y=b[0];
    if(x.pts!==y.pts) return y.pts-x.pts;
    if(x.v!==y.v) return y.v-x.v;
    if(x.sg!==y.sg) return y.sg-x.sg;
    return y.gp-x.gp;
  });

  const resultado = [];
  grupos.forEach(grupo=>{
    if(grupo.length===1){ resultado.push(grupo[0]); return; }

    if(grupo.length===2){
      // Critério 5: confronto direto (só vale empate entre 2 clubes)
      const [a,b] = grupo;
      const entreSi = jogos.filter(j=>(j.casa===a.nome&&j.vis===b.nome)||(j.casa===b.nome&&j.vis===a.nome));
      let ptsA=0, ptsB=0, sgA=0;
      entreSi.forEach(j=>{
        const golsA = j.casa===a.nome ? j.gC : j.gV;
        const golsB = j.casa===a.nome ? j.gV : j.gC;
        sgA += (golsA||0) - (golsB||0);
        if(golsA>golsB) ptsA+=3; else if(golsA<golsB) ptsB+=3; else { ptsA++; ptsB++; }
      });
      if(ptsA!==ptsB){ resultado.push(ptsA>ptsB?a:b, ptsA>ptsB?b:a); return; }
      if(sgA!==0){ resultado.push(sgA>0?a:b, sgA>0?b:a); return; }
      // confronto direto também empatado: cai pros cartões (critérios 6 e 7)
      resultado.push(...[...grupo].sort(porCartoes));
      return;
    }

    // 3+ times empatados: confronto direto não se aplica, vai direto pros cartões
    resultado.push(...[...grupo].sort(porCartoes));
  });

  return resultado;
}

// Mini-tabela (pontos/saldo/gols/gols fora) só dos jogos ENTRE os times do grupo
// informado — usada pelos critérios "confronto direto" das ligas estrangeiras.
function miniConfrontoDireto(grupo, jogos){
  const nomes = grupo.map(t=>t.nome);
  const entreSi = jogos.filter(j=>nomes.includes(j.casa) && nomes.includes(j.vis));
  const mini = {};
  nomes.forEach(n=>{ mini[n] = { pts:0, gp:0, gc:0, golsFora:0 }; });
  entreSi.forEach(j=>{
    const mc = mini[j.casa], mv = mini[j.vis];
    mc.gp += (j.gC||0); mc.gc += (j.gV||0);
    mv.gp += (j.gV||0); mv.gc += (j.gC||0);
    mv.golsFora += (j.gV||0); // gol marcado pelo visitante jogando fora
    if(j.gC>j.gV) mc.pts+=3; else if(j.gC<j.gV) mv.pts+=3; else { mc.pts++; mv.pts++; }
  });
  Object.keys(mini).forEach(n=>{ mini[n].sg = mini[n].gp - mini[n].gc; });
  return mini;
}

// Aplica uma cadeia de critérios de desempate em sequência: reordena o grupo pelo
// 1º critério, reagrupa quem ainda empatou, e resolve cada subgrupo empatado com
// os critérios seguintes — recursivamente. Critérios tipo "confronto" recalculam
// a mini-tabela sempre em cima do grupo empatado NAQUELE ponto da cadeia (que pode
// já ser menor que o grupo original, se critérios anteriores já separaram alguns times).
// O que sobrar empatado no fim (regra de sorteio/jogo-desempate/playoff) fica na
// ordem que já estava — não dá pra simular esse desempate.
function aplicarCriterios(grupo, criterios, jogos){
  if(grupo.length<=1 || !criterios.length) return grupo;
  const [crit, ...resto] = criterios;
  const valor = crit.tipo==='confronto'
    ? (()=>{ const mini = miniConfrontoDireto(grupo, jogos); return t=>mini[t.nome][crit.campo]; })()
    : (t=>t[crit.campo]);

  const ordenado = [...grupo].sort((a,b)=>valor(b)-valor(a));
  const subgrupos = [];
  let atual = [ordenado[0]];
  for(let i=1;i<ordenado.length;i++){
    if(valor(ordenado[i])===valor(atual[0])) atual.push(ordenado[i]);
    else { subgrupos.push(atual); atual=[ordenado[i]]; }
  }
  subgrupos.push(atual);
  return subgrupos.flatMap(sg => aplicarCriterios(sg, resto, jogos));
}

// Critérios OFICIAIS de desempate de cada liga estrangeira coberta (fonte: regulamento
// de cada campeonato). Sempre que o grupo empata em todos os critérios listados, o que
// sobra é decidido por sorteio/jogo de desempate/playoff — não simulável, fica como está.
const CRITERIOS_LIGA = {
  'Premier League': [ // Inglaterra
    {tipo:'geral', campo:'pts'}, {tipo:'geral', campo:'sg'}, {tipo:'geral', campo:'gp'},
    {tipo:'confronto', campo:'pts'}, {tipo:'confronto', campo:'golsFora'},
  ],
  'La Liga': [ // Espanha
    {tipo:'geral', campo:'pts'},
    {tipo:'confronto', campo:'pts'}, {tipo:'confronto', campo:'sg'},
    {tipo:'geral', campo:'sg'}, {tipo:'geral', campo:'gp'},
  ],
  'Bundesliga': [ // Alemanha
    {tipo:'geral', campo:'pts'}, {tipo:'geral', campo:'sg'}, {tipo:'geral', campo:'gp'},
    {tipo:'confronto', campo:'pts'}, {tipo:'confronto', campo:'gp'}, {tipo:'confronto', campo:'golsFora'},
  ],
  'Serie A': [ // Itália (sem acento — diferente da "Série A" do Brasil)
    {tipo:'geral', campo:'pts'},
    {tipo:'confronto', campo:'pts'}, {tipo:'confronto', campo:'sg'},
    {tipo:'geral', campo:'sg'}, {tipo:'geral', campo:'gp'},
  ],
  'Ligue 1': [ // França
    {tipo:'geral', campo:'pts'}, {tipo:'geral', campo:'sg'},
    {tipo:'confronto', campo:'pts'}, {tipo:'confronto', campo:'sg'},
    {tipo:'geral', campo:'gp'}, {tipo:'geral', campo:'v'}, {tipo:'geral', campo:'vFora'},
    {tipo:'geral', campo:'fairPlay'},
  ],
  'Eredivisie': [ // Holanda
    {tipo:'geral', campo:'pts'}, {tipo:'geral', campo:'sg'}, {tipo:'geral', campo:'gp'},
    {tipo:'confronto', campo:'pts'},
  ],
  'Primeira Liga': [ // Portugal — Liga Portugal Betclic, regulamento 2026/27
    {tipo:'confronto', campo:'pts'}, {tipo:'confronto', campo:'sg'},
    {tipo:'geral', campo:'sg'}, {tipo:'geral', campo:'v'}, {tipo:'geral', campo:'gp'},
    // Detalhe do regulamento que a simulação não cobre: se as duas equipas ainda não
    // se enfrentaram nos 2 jogos do returno, o critério de saldo do confronto direto
    // não é pra valer — aqui ele sempre entra na conta (mesma simplificação já usada
    // pros outros campeonatos: o que sobrar empatado fica na ordem que já estava).
  ],
  'Liga MX': [ // México
    {tipo:'geral', campo:'pts'}, {tipo:'geral', campo:'sg'}, {tipo:'geral', campo:'gp'},
    {tipo:'confronto', campo:'pts'}, {tipo:'geral', campo:'gpFora'}, {tipo:'geral', campo:'fairPlay'},
    // "Tabla General de Cociente" (posição por aproveitamento histórico entre várias
    // temporadas) não dá pra simular só com os jogos de uma temporada — e depois dela
    // ainda tem sorteio. Se empatar até aqui, fica na ordem que já estava (igual às
    // outras ligas).
  ],
};
CRITERIOS_LIGA['2. Bundesliga'] = CRITERIOS_LIGA['Bundesliga']; // mesmos critérios da Bundesliga

function ordenarPorCriteriosOficiais(linhas, jogos, camp){
  const criterios = CRITERIOS_LIGA[camp];
  if(!criterios) return null;
  // fairPlay: quanto MENOS cartão, melhor — inverte o sinal pra caber no "maior valor vence" da cadeia
  const comFairPlay = linhas.map(l=>({ ...l, fairPlay: -(l.vermelhos*3 + l.amarelos) }));
  // Agrupa tudo junto de início (sem pré-agrupar por pts como no Brasileirão) — a cadeia de
  // critérios já cuida de separar por pontos no 1º passo e ir refinando os empates.
  return aplicarCriterios(comFairPlay, criterios, jogos);
}

function computeClassificacao(camp, modo){
  modo = modo === 'casa' || modo === 'visitante' ? modo : 'geral';
  if(/copa do mundo|amistoso/i.test(camp)) return { estado:'sem-classificacao', camp };

  const jogos = camp ? jogosCache.filter(j=>j.camp===camp) : [];
  // Champions League: só entra na tabela de pontos corrida quem é da Fase Liga —
  // jogos de Qualificação/Playoffs são mata-mata (rodada guardada como "Qualificação -
  // <etapa>" / "Playoffs - <etapa>", ver AdicionarPartida.jsx) e não contam pra
  // classificação por pontos, senão o saldo/pontos ficam errados.
  const jogosParaTabela = /champions league/i.test(camp)
    ? jogos.filter(j => !/^qualifica[cç][aã]o\s*-|^playoffs\s*-/i.test((j.rodada||'').trim()))
    : jogos;
  if(!jogosParaTabela.length) return { estado: jogosCache.length ? 'sem-jogos-liga' : 'sem-jogos', camp };

  const jogosOrdenados = [...jogosParaTabela].sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  const rankPorTime = {};
  jogosOrdenados.forEach(j=>{
    if(j.rankC!=null) rankPorTime[j.casa] = j.rankC;
    if(j.rankV!=null) rankPorTime[j.vis]  = j.rankV;
  });

  const tab = {};
  function linhaTime(nome){ return tab[nome] || (tab[nome] = {j:0,v:0,e:0,d:0,gp:0,gc:0,vermelhos:0,amarelos:0,vFora:0,gpFora:0}); }
  const incluiCasa = modo!=='visitante';
  const incluiVis  = modo!=='casa';
  jogosParaTabela.forEach(j=>{
    if(incluiCasa){
      const c = linhaTime(j.casa);
      c.j++; c.gp += (j.gC||0); c.gc += (j.gV||0);
      c.vermelhos += (j.vermelhosC||0); c.amarelos += (j.amarelosC||0);
      if(j.gC>j.gV) c.v++; else if(j.gC<j.gV) c.d++; else c.e++;
    }
    if(incluiVis){
      const v = linhaTime(j.vis);
      v.j++; v.gp += (j.gV||0); v.gc += (j.gC||0); v.gpFora += (j.gV||0);
      v.vermelhos += (j.vermelhosV||0); v.amarelos += (j.amarelosV||0);
      if(j.gV>j.gC){ v.v++; v.vFora++; } else if(j.gV<j.gC) v.d++; else v.e++;
    }
  });

  const ehBrasileirao = /brasileir[ãa]o/i.test(camp);

  let linhas = Object.keys(tab).map(nome=>{
    const t = tab[nome];
    const pts = t.v*3 + t.e;
    const rank = rankPorTime[nome] ?? null;
    return { nome, pts, ...t, sg: t.gp-t.gc, rank };
  });

  if(modo!=='geral'){
    // "Em casa" / "Visitante" são recortes (só parte dos jogos de cada time), não a
    // temporada inteira — os critérios OFICIAIS de desempate (que dependem do
    // confronto direto entre todos) não fazem sentido aqui. Ordena só por
    // pontos/saldo/gols pró, e a posição não usa o rank oficial da API.
    linhas = linhas.sort((a,b)=> b.pts-a.pts || b.sg-a.sg || b.gp-a.gp).map((l,i)=>({ ...l, rank:i+1 }));
  } else if(ehBrasileirao){
    // Brasileirão: API não entrega mais o rank (plano gratuito não libera a temporada
    // atual), então a posição É calculada manualmente com os critérios oficiais da CBF.
    linhas = ordenarBrasileirao(linhas, jogosParaTabela).map((l,i)=>({ ...l, rank: i+1 }));
  } else if(CRITERIOS_LIGA[camp]){
    // Ligas estrangeiras cobertas: calcula com os critérios OFICIAIS de cada uma, sem
    // depender do rank da API (se a API falhar ou não trouxer rank, o app não fica sem
    // classificação nem usa uma ordenação genérica errada — calcula sozinho, igual ao Brasileirão).
    linhas = ordenarPorCriteriosOficiais(linhas, jogosParaTabela, camp).map((l,i)=>({ ...l, rank: i+1 }));
  } else {
    // Ligas não cobertas: usa o rank da API quando disponível; sem rank, cai no fallback
    // simples por pontos (critérios de desempate variam liga a liga, não implementados aqui).
    linhas = linhas.sort((a,b)=>{
      const chaveA = a.rank!=null ? a.rank : (100000-a.pts);
      const chaveB = b.rank!=null ? b.rank : (100000-b.pts);
      if(chaveA!==chaveB) return chaveA-chaveB;
      return b.sg-a.sg;
    });
  }

  // As zonas (G4, rebaixamento etc.) só valem pra posição oficial da temporada
  // inteira — não fazem sentido recalculadas em cima de um recorte casa/visitante.
  linhas = linhas.map(l=>({ ...l, zona: modo==='geral' ? zonaPosicao(camp, l.rank) : null }));

  return { estado:'ok', camp, modo, linhas, zonas: modo==='geral' ? zonasDaLiga(camp) : null };
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

  if (estado==='ok')     setSyncStatus('ok', 'Banca sincronizada');
  if (estado==='sync')   setSyncStatus('sync', 'Sincronizando banca...');
  if (estado==='erro')   setSyncStatus('erro', 'Erro ao sincronizar a banca');
  if (estado==='config') setSyncStatus('config', 'Sem conexão com o banco de dados');
}

// (as antigas saldoParticipante/plParticipante/totalSaldos/cotaAtual/roiParticipante
// foram removidas — não fazem mais sentido numa carteira individual. O que elas
// calculavam agora vem de window.computeCarteira(), em 14-banca-gestao.js.)

