// ═══════════════════════════════════════════════════
// ABA ANÁLISE — seletores de time, filtros, estatísticas (over/under, ambas marcam, etc.), cálculo de probabilidades
// ═══════════════════════════════════════════════════
// Seletor de campeonato/times/filtros migrado pra React: src/components/SeletorAnalise.jsx
// (mantém window.filtro em 02-dados-crud.js como ponte pro cálculo abaixo)

// ══ STATS TIME ══
function jogosDoTime(nome, local, camp, qty){
  if(!nome) return [];
  let jogos=[...jogosCache];
  if(camp) jogos=jogos.filter(j=>j.camp===camp);
  if(local==='casa') jogos=jogos.filter(j=>j.casa===nome);
  else if(local==='fora') jogos=jogos.filter(j=>j.vis===nome);
  else jogos=jogos.filter(j=>j.casa===nome||j.vis===nome);
  jogos.sort((a,b)=>{ const da=a.data?new Date(a.data):new Date(0); const db=b.data?new Date(b.data):new Date(0); return db-da; });
  if(qty>0) jogos=jogos.slice(0,qty);
  return jogos;
}

// Tamanho de cada campeonato = maior posição de ranking já vista nos jogos cadastrados.
// Serve de "régua" para saber se um adversário está acima ou abaixo da média da tabela.
function tamanhoCampeonato(camp){
  const ranks = jogosCache
    .filter(j=>j.camp===camp)
    .flatMap(j=>[j.rankC, j.rankV])
    .filter(r=>r!=null);
  return ranks.length ? Math.max(...ranks) : null;
}

// Fator de ajuste de um único jogo, pela força do adversário daquela partida.
// Retorna 1 quando o adversário está exatamente na média da tabela.
// > 1 quando o adversário é mais forte que a média (rank menor); < 1 quando é mais fraco.
const INTENSIDADE_AJUSTE = 0.6;
function fatorForcaAdversario(rankAdv, tamanhoCamp){
  if(rankAdv==null || !tamanhoCamp || tamanhoCamp<=1) return 1;
  const posicaoMedia = (tamanhoCamp+1)/2;
  const metade = (tamanhoCamp-1)/2;
  if(metade<=0) return 1;
  const desvio = (posicaoMedia - rankAdv) / metade; // +1 (adversário mais forte possível) a -1 (mais fraco possível)
  return 1 + (desvio * INTENSIDADE_AJUSTE);
}
// Médias da liga (ou de todos os campeonatos, se nenhum filtro) por jogo/time, usadas para
// normalizar chutes no alvo, cantos e cartões vermelhos no Índice de Força.
function mediasLiga(camp){
  const jogos = camp ? jogosCache.filter(j=>j.camp===camp) : jogosCache;
  function avgPar(fc, fv){
    const vals=[];
    jogos.forEach(j=>{ if(j[fc]!=null) vals.push(j[fc]); if(j[fv]!=null) vals.push(j[fv]); });
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  }
  return {
    gols:        avgPar('gC','gV') || 1,
    chutesGol:   avgPar('chutesGolC','chutesGolV'),
    chutesTotal: avgPar('chutesC','chutesV'),
    cantos:      avgPar('escanteiosC','escanteiosV'),
    vermelhos:   avgPar('vermelhosC','vermelhosV'),
  };
}

function statsTime(nome, local, camp, qty){
  const jogos=jogosDoTime(nome, local, camp, qty);
  const nt=jogos.length;
  const como_casa=jogos.filter(j=>j.casa===nome), como_vis=jogos.filter(j=>j.vis===nome);
  const gmTot=jogos.reduce((s,j)=>s+(j.casa===nome?j.gC:j.gV),0);
  const gsTot=jogos.reduce((s,j)=>s+(j.casa===nome?j.gV:j.gC),0);
  const gmCasa=como_casa.reduce((s,j)=>s+j.gC,0), gsCasa=como_casa.reduce((s,j)=>s+j.gV,0);
  const gmVis=como_vis.reduce((s,j)=>s+j.gV,0),   gsVis=como_vis.reduce((s,j)=>s+j.gC,0);
  const nc=como_casa.length, nv=como_vis.length;
  const vedCasa = como_casa.reduce((acc,j)=>{ if(j.gC>j.gV) acc.v++; else if(j.gC===j.gV) acc.e++; else acc.d++; return acc; }, {v:0,e:0,d:0});
  const vedFora = como_vis.reduce((acc,j)=>{ if(j.gV>j.gC) acc.v++; else if(j.gV===j.gC) acc.e++; else acc.d++; return acc; }, {v:0,e:0,d:0});
  const lambda=nt?r2(gmTot/nt):0; // ataque, sem ajuste (mantido para comparação)
  const lambdaDef=nt?r2(gsTot/nt):0; // defesa, sem ajuste (gols sofridos por jogo)

  // ── Gols do 1º tempo (HT) — só conta jogos com esse dado preenchido ──
  const jogosComHT = jogos.filter(j=>(j.casa===nome?j.golsHT_C:j.golsHT_V)!=null);
  const ntHT = jogosComHT.length;
  const gmHT = jogosComHT.reduce((s,j)=>s+(j.casa===nome?j.golsHT_C:j.golsHT_V),0);
  const gsHT = jogosComHT.reduce((s,j)=>s+(j.casa===nome?j.golsHT_V:j.golsHT_C),0);
  const lambdaHT    = ntHT?r2(gmHT/ntHT):0;
  const lambdaDefHT = ntHT?r2(gsHT/ntHT):0;

  // ── Desempenho (V/E/D) e médias casa/fora do 1º tempo — só jogos com golsHT preenchido ──
  const comoCasaHT = como_casa.filter(j=>j.golsHT_C!=null && j.golsHT_V!=null);
  const comoVisHT  = como_vis.filter(j=>j.golsHT_C!=null && j.golsHT_V!=null);
  const ncHT = comoCasaHT.length, nvHT = comoVisHT.length;
  const gmCasaHT = comoCasaHT.reduce((s,j)=>s+j.golsHT_C,0), gsCasaHT = comoCasaHT.reduce((s,j)=>s+j.golsHT_V,0);
  const gmVisHT  = comoVisHT.reduce((s,j)=>s+j.golsHT_V,0),  gsVisHT  = comoVisHT.reduce((s,j)=>s+j.golsHT_C,0);
  const vedCasaHT = comoCasaHT.reduce((acc,j)=>{ if(j.golsHT_C>j.golsHT_V) acc.v++; else if(j.golsHT_C===j.golsHT_V) acc.e++; else acc.d++; return acc; }, {v:0,e:0,d:0});
  const vedForaHT = comoVisHT.reduce((acc,j)=>{ if(j.golsHT_V>j.golsHT_C) acc.v++; else if(j.golsHT_V===j.golsHT_C) acc.e++; else acc.d++; return acc; }, {v:0,e:0,d:0});

  // ── Ajuste pela força do adversário enfrentado em cada jogo ──
  // Para cada jogo, calcula um fator de dificuldade (acima de 1 = adversário forte, abaixo de 1 = fraco).
  // O lambda ajustado escala o lambda simples pela média desses fatores.
  let somaFatorAtaque=0, somaFatorDef=0;
  jogos.forEach(j=>{
    const rankAdv  = j.casa===nome ? j.rankV : j.rankC;
    const tamCamp  = tamanhoCampeonato(j.camp);
    const fator    = fatorForcaAdversario(rankAdv, tamCamp);
    somaFatorAtaque += fator;
    // para defesa, o fator se inverte: sofrer gol de um time fraco (fator baixo) deveria pesar mais
    somaFatorDef += fator>0 ? (1/fator) : 1;
  });
  const fatorMedioAtaque = nt>0 ? somaFatorAtaque/nt : 1;
  const fatorMedioDef    = nt>0 ? somaFatorDef/nt    : 1;
  const lambdaAjustado    = r2(lambda * fatorMedioAtaque);
  const lambdaDefAjustado = r2(lambdaDef * fatorMedioDef);

  const ranks=jogos.map(j=>j.casa===nome?j.rankV:j.rankC).filter(r=>r!=null);
  const rankMedAdv=ranks.length?r2(ranks.reduce((a,b)=>a+b,0)/ranks.length):null;
  // Rank médio do PRÓPRIO time (não do adversário) — usa o rank que ele tinha em cada
  // jogo, seja como mandante ou visitante. Serve de base pra comparar contra o rank do
  // outro time no "Comportamento por Faixa de Força" logo abaixo.
  const ranksProprio=jogos.map(j=>j.casa===nome?j.rankC:j.rankV).filter(r=>r!=null);
  const rankMedProprio=ranksProprio.length?r2(ranksProprio.reduce((a,b)=>a+b,0)/ranksProprio.length):null;
  const calendario=jogos.map(j=>({
    adv:j.casa===nome?j.vis:j.casa, rank:j.casa===nome?j.rankV:j.rankC, data:j.data, camp:j.camp,
    tamCamp:tamanhoCampeonato(j.camp), casaNome:j.casa, visNome:j.vis, gC:j.gC, gV:j.gV,
    rankCasa:j.rankC, rankVis:j.rankV, mandante:j.casa===nome,
    golsHT_C:j.golsHT_C ?? null, golsHT_V:j.golsHT_V ?? null,
    chutesC:j.chutesC ?? null, chutesV:j.chutesV ?? null,
    chutesGolC:j.chutesGolC ?? null, chutesGolV:j.chutesGolV ?? null,
    escanteiosC:j.escanteiosC ?? null, escanteiosV:j.escanteiosV ?? null,
    amarelosC:j.amarelosC ?? null, amarelosV:j.amarelosV ?? null,
    vermelhosC:j.vermelhosC ?? null, vermelhosV:j.vermelhosV ?? null,
    gols:j.gols || [],
  })).filter(x=>x.rank);
  const todosGols=jogos.flatMap(j=>(j.gols||[]).map(g=>({ min:g.min, marcado:(j.casa===nome&&g.time==='casa')||(j.vis===nome&&g.time==='vis') })));
  const jogosComMin=jogos.filter(j=>(j.gols||[]).length>0).length;
  const minStats=periodos4.map(p=>({ l:p.l, ico:p.ico, marc:todosGols.filter(g=>g.marcado&&g.min>=p.s&&g.min<=p.e).length, sofr:todosGols.filter(g=>!g.marcado&&g.min>=p.s&&g.min<=p.e).length }));

  // ── Minutos dos gols restritos ao 1º tempo (min<=45) — mesma base de dados, só filtrada ──
  // Os cartões e escanteios não têm minuto registrado (só total do jogo), por isso não dá
  // pra fazer essa mesma visão pra eles. Gols têm minuto real, então dá pra recortar.
  const todosGolsHT = todosGols.filter(g=>g.min!=null && g.min<=45);
  const jogosComMinHT = jogos.filter(j=>(j.gols||[]).some(g=>g.min!=null && g.min<=45)).length;
  const minStatsHT = periodos4.slice(0,2).map(p=>({ l:p.l, ico:p.ico, marc:todosGolsHT.filter(g=>g.marcado&&g.min>=p.s&&g.min<=p.e).length, sofr:todosGolsHT.filter(g=>!g.marcado&&g.min>=p.s&&g.min<=p.e).length }));

  // ── Sequência de gols por jogo (marcados e sofridos separados) ──
  // Para cada jogo com minutos, pegar os minutos em ordem
  const jogosComGols = jogos.filter(j=>(j.gols||[]).length>0);

  // Minutos dos gols MARCADOS em ordem (1º, 2º, 3º...) por jogo
  const seqMarcados = jogosComGols.map(j=>{
    const gM = (j.gols||[]).filter(g=>(j.casa===nome&&g.time==='casa')||(j.vis===nome&&g.time==='vis')).map(g=>g.min).sort((a,b)=>a-b);
    return gM;
  });
  // Minutos dos gols SOFRIDOS em ordem por jogo
  const seqSofridos = jogosComGols.map(j=>{
    const gS = (j.gols||[]).filter(g=>!((j.casa===nome&&g.time==='casa')||(j.vis===nome&&g.time==='vis'))).map(g=>g.min).sort((a,b)=>a-b);
    return gS;
  });
  // Minutos de TODOS os gols do jogo (independente de quem) em ordem
  const seqTodos = jogosComGols.map(j=>{
    return (j.gols||[]).map(g=>g.min).sort((a,b)=>a-b);
  });

  // Média do Nº gol em cada posição
  function mediaGolNa(seq, pos){ // pos=0 é o 1º gol
    const vals=seq.map(s=>s[pos]).filter(v=>v!==undefined);
    if(!vals.length) return null;
    return r2(vals.reduce((a,b)=>a+b,0)/vals.length);
  }

  // Calcular médias para posições 1 a 5
  const mediasGolJogo=[]; // todos os gols do jogo
  const mediasMarc=[];     // só marcados
  const mediasSofr=[];     // só sofridos
  for(let i=0;i<5;i++){
    mediasGolJogo.push(mediaGolNa(seqTodos, i));
    mediasMarc.push(mediaGolNa(seqMarcados, i));
    mediasSofr.push(mediaGolNa(seqSofridos, i));
  }

  // Média geral do minuto de marcação e sofrimento
  const minsMarcados = todosGols.filter(g=>g.marcado).map(g=>g.min);
  const minsSofridos = todosGols.filter(g=>!g.marcado).map(g=>g.min);
  const mediaMinMarc = minsMarcados.length ? r2(minsMarcados.reduce((a,b)=>a+b,0)/minsMarcados.length) : null;
  const mediaMinSofr = minsSofridos.length ? r2(minsSofridos.reduce((a,b)=>a+b,0)/minsSofridos.length) : null;

  // ── Índice de Força (Ofensivo) ──
  // Combina, com pesos, 4 fatores: Gols (50%), Chutes no Alvo (25%), Cantos (15%) e Cartões Vermelhos (penalidade -10%).
  // Pesos de gols/chutes/cantos são renormalizados para somar 100% quando algum dado não existe (ex: jogos antigos sem chutes/cantos).
  let somaChutesGolMarc=0, nChutesGol=0, somaChutesTotMarc=0, nChutesTot=0, somaCantosMarc=0, nCantos=0, somaVermProprio=0, nVerm=0, somaAmarProprio=0, nAmar=0;
  jogos.forEach(j=>{
    const cg = j.casa===nome ? j.chutesGolC : j.chutesGolV;
    if(cg!=null){ somaChutesGolMarc+=cg; nChutesGol++; }
    const ctot = j.casa===nome ? j.chutesC : j.chutesV;
    if(ctot!=null){ somaChutesTotMarc+=ctot; nChutesTot++; }
    const ct = j.casa===nome ? j.escanteiosC : j.escanteiosV;
    if(ct!=null){ somaCantosMarc+=ct; nCantos++; }
    const vp = j.casa===nome ? j.vermelhosC : j.vermelhosV;
    if(vp!=null){ somaVermProprio+=vp; nVerm++; }
    const ap = j.casa===nome ? j.amarelosC : j.amarelosV;
    if(ap!=null){ somaAmarProprio+=ap; nAmar++; }
  });
  const mediaChutesGolMarc = nChutesGol ? somaChutesGolMarc/nChutesGol : null;
  const mediaChutesTotMarc = nChutesTot ? somaChutesTotMarc/nChutesTot : null;
  const mediaCantosMarc    = nCantos    ? somaCantosMarc/nCantos       : null;
  const mediaVermProprio   = nVerm      ? somaVermProprio/nVerm        : null;
  const mediaAmarProprio   = nAmar      ? somaAmarProprio/nAmar        : null;

  // % de jogos (do filtro atual) que têm o dado preenchido — usado como "confiança" das estatísticas.
  const confCantos   = nt ? Math.round((nCantos/nt)*100)   : 0;
  const confCartoes  = nt ? Math.round((Math.min(nAmar,nVerm)/nt)*100) : 0;
  const confChutes   = nt ? Math.round((Math.min(nChutesGol,nChutesTot)/nt)*100) : 0;

  const liga = mediasLiga(camp);
  const PESOS_BASE = { gols:0.50, chutesAlvo:0.25, chutesTotal:0.05, cantos:0.15 };
  const comps = [{ peso:PESOS_BASE.gols, ratio: liga.gols ? lambdaAjustado/liga.gols : 1 }];
  if(mediaChutesGolMarc!=null && liga.chutesGol) comps.push({ peso:PESOS_BASE.chutesAlvo, ratio: mediaChutesGolMarc/liga.chutesGol });
  if(mediaChutesTotMarc!=null && liga.chutesTotal) comps.push({ peso:PESOS_BASE.chutesTotal, ratio: mediaChutesTotMarc/liga.chutesTotal });
  if(mediaCantosMarc!=null    && liga.cantos)    comps.push({ peso:PESOS_BASE.cantos, ratio: mediaCantosMarc/liga.cantos });
  const pesoTotal = comps.reduce((s,c)=>s+c.peso,0);
  const indiceBase = comps.reduce((s,c)=>s+(c.peso/pesoTotal)*c.ratio, 0);

  // Penalidade por indisciplina (cartões vermelhos sofridos pelo próprio time, vs média da liga)
  let fatorDisciplina=1;
  if(mediaVermProprio!=null && liga.vermelhos){
    const ratioVerm = mediaVermProprio/liga.vermelhos;
    fatorDisciplina = Math.max(0.7, Math.min(1.15, 1 - 0.10*(ratioVerm-1)));
  }

  const indiceForca = r2(indiceBase * fatorDisciplina);
  // Reconverte o índice (relativo à média=1) para gols/jogo, com limites de sanidade.
  const lambdaIndice = Math.max(0.1, Math.min(6, r2(liga.gols * indiceForca)));

  return { nome, nt, nc, nv, local, qty, mediaGM_casa:nc?r2(gmCasa/nc):0, mediaGS_casa:nc?r2(gsCasa/nc):0, mediaGM_vis:nv?r2(gmVis/nv):0, mediaGS_vis:nv?r2(gsVis/nv):0, vedCasa, vedFora,
    ncHT, nvHT, mediaGM_casaHT:ncHT?r2(gmCasaHT/ncHT):0, mediaGS_casaHT:ncHT?r2(gsCasaHT/ncHT):0, mediaGM_visHT:nvHT?r2(gmVisHT/nvHT):0, mediaGS_visHT:nvHT?r2(gsVisHT/nvHT):0, vedCasaHT, vedForaHT,
    lambda, lambdaDef, lambdaAjustado, lambdaDefAjustado, lambdaHT, lambdaDefHT, ntHT, lambdaIndice, indiceForca, mediaChutesGolMarc, mediaChutesTotMarc, mediaCantosMarc, mediaVermProprio, mediaAmarProprio, confCantos, confCartoes, confChutes, rankMedAdv, rankMedProprio, calendario, minStats, jogosComMin, minStatsHT, jogosComMinHT, todosGols, mediasGolJogo, mediasMarc, mediasSofr, mediaMinMarc, mediaMinSofr, jogosComGols:jogosComGols.length };
}


// Estado global das probabilidades calculadas
let ultimaAnalise = null;

// ══ TABELA DE MINUTOS DOS GOLS (usada na sub-aba Estatísticas) ══
// Continua devolvendo um pedaço de HTML pronto (é só uma tabelinha visual, sem
// lógica de negócio) — o componente React injeta isso com dangerouslySetInnerHTML,
// igual já se fazia com escudos de time.
function renderMinTabela(s, modoTempo){
  const ht = modoTempo==='ht';
  const minStats = ht ? s.minStatsHT : s.minStats;
  const jogosComMin = ht ? s.jogosComMinHT : s.jogosComMin;
  if(!jogosComMin) return `<div class="empty" style="padding:16px"><div class="icon" style="font-size:24px"><span data-ic="clock" data-ic-size="24"></span></div><p>Sem minutos de gols${ht?' no 1º tempo':''} registrados.</p></div>`;
  const picoM=minStats.indexOf(minStats.reduce((a,b)=>b.marc>a.marc?b:a));
  const picoS=minStats.indexOf(minStats.reduce((a,b)=>b.sofr>a.sofr?b:a));
  const totMarc=minStats.reduce((a,b)=>a+b.marc,0);
  const totSofr=minStats.reduce((a,b)=>a+b.sofr,0);
  const cards=minStats.map((p,i)=>{
    const isPicoM=(i===picoM), isPicoS=(i===picoS);
    const cls=isPicoM?'pico-marc':isPicoS?'pico-sofr':'';
    const tag=isPicoM?'<div class="pc-tag"><span data-ic="target" data-ic-size="11"></span> Pico Marc.</div>':isPicoS?'<div class="pc-tag"><span data-ic="goalNet" data-ic-size="11"></span> Pico Sofr.</div>':'';
    return `<div class="periodo-card ${cls}">
      <div class="pc-label">${p.l}</div>
      <div class="pc-row"><span class="pc-ico" data-ic="target" data-ic-size="12"></span><span class="pc-val marc">${p.marc}</span></div>
      <div class="pc-row"><span class="pc-ico" data-ic="goalNet" data-ic-size="12"></span><span class="pc-val sofr">${p.sofr}</span></div>
      ${tag}
    </div>`;
  }).join('');
  return `<div class="periodo-cards">${cards}</div>
  <div class="min-insight" style="margin-top:10px">
    <span data-ic="target" data-ic-size="12"></span> Total marcados: <strong>${totMarc}</strong> &nbsp;·&nbsp; <span data-ic="goalNet" data-ic-size="12"></span> Total sofridos: <strong>${totSofr}</strong><br>
    Marca mais: <strong>${minStats[picoM].l}</strong> &nbsp;·&nbsp; Sofre mais: <strong>${minStats[picoS].l}</strong><br>
    <span style="color:var(--texto2)">${jogosComMin} jogo(s) com minutos registrados${ht?' no 1º tempo':''}</span>
  </div>`;
}
function calNivel(r, tamCamp){
  if(!r) return null;
  if(!tamCamp || tamCamp<=1) return 'medio';
  const pct = (r-1)/(tamCamp-1); // 0 = melhor time do campeonato, 1 = pior
  if(pct <= 1/3) return 'dificil';
  if(pct <= 2/3) return 'medio';
  return 'facil';
}
function calDot(r, tamCamp){ const n=calNivel(r,tamCamp); return n||'facil'; }
function calLbl(r, tamCamp){ const n=calNivel(r,tamCamp); return n==='dificil'?'difícil':n==='medio'?'médio':n==='facil'?'fácil':'—'; }

// Comportamento do time contra adversários de uma faixa de força parecida com um rank-alvo
// (normalmente o rank médio do outro time da partida sendo analisada) — ex: "Time X (rank 1)
// contra adversários por volta do rank 11: qual a taxa de aproveitamento?". Pega os jogos do
// calendário do time com o rank do adversário mais PRÓXIMO do alvo (ranks raramente se repetem
// de um jogo pro outro, então "mais próximo" é melhor que "exatamente igual"), até N jogos, e
// calcula V/E/D + aproveitamento (padrão do futebol: pontos ganhos ÷ pontos possíveis × 100).
function aproveitamentoVsFaixaRank(calendario, rankAlvo, n=8){
  if(!rankAlvo || !calendario?.length) return null;
  const comRank = calendario.filter(c=>c.rank!=null && c.gC!=null && c.gV!=null);
  if(!comRank.length) return null;
  const maisProximos = [...comRank].sort((a,b)=>Math.abs(a.rank-rankAlvo)-Math.abs(b.rank-rankAlvo)).slice(0,n);
  const ved = maisProximos.reduce((acc,c)=>{
    const golsPro = c.mandante ? c.gC : c.gV, golsContra = c.mandante ? c.gV : c.gC;
    if(golsPro>golsContra) acc.v++; else if(golsPro===golsContra) acc.e++; else acc.d++;
    return acc;
  }, {v:0,e:0,d:0});
  const jg = maisProximos.length;
  const aproveitamento = jg ? Math.round(((ved.v*3+ved.e)/(jg*3))*1000)/10 : 0;
  const rankMedioAmostra = r2(maisProximos.reduce((s,c)=>s+c.rank,0)/jg);
  return { jogos:jg, v:ved.v, e:ved.e, d:ved.d, aproveitamento, rankMedioAmostra };
}

// Tendência de um mercado (V/E/D, Over X.5, Ambas Marcam etc): compara a taxa de acerto nos
// últimos 5 jogos contra os últimos 10 pra saber se o time tá GANHANDO ou PERDENDO força
// recentemente — não adianta só olhar "quantos de 5" sem ver a ORDEM. calendario já vem do
// mais recente pro mais antigo (ver jogosDoTime); testeHit(c) recebe um item do calendário e
// devolve true/false (bateu o mercado ou não naquele jogo).
function tendenciaMercado(calendario, testeHit, n=10){
  const validos = calendario.filter(c=>c.gC!=null && c.gV!=null);
  if(validos.length<3) return null;
  const u10 = validos.slice(0,n);
  const u5  = validos.slice(0,5);
  const hits10 = u10.filter(testeHit).length;
  const hits5  = u5.filter(testeHit).length;
  const pct10 = Math.round((hits10/u10.length)*100);
  const pct5  = Math.round((hits5/u5.length)*100);
  const diff = pct5-pct10;
  const tendencia = diff>=15 ? 'subindo' : diff<=-15 ? 'descendo' : 'estavel';
  // sequência exibida do mais antigo pro mais recente (leitura de linha do tempo, igual o
  // usuário pediu — ex: "V-V-V-E-D" com o "D" sendo o jogo mais recente)
  const sequencia = [...u5].reverse().map(c=>testeHit(c));
  return { total10:u10.length, hits10, pct10, total5:u5.length, hits5, pct5, sequencia, tendencia };
}

// ══ CALCULA ANÁLISE — motor puro, sem tocar em DOM nenhum ══
// Recebe os times/campeonato/filtro escolhidos (vindos do SeletorAnalise.jsx) e devolve
// um objeto com TUDO que a tela precisa. Quem desenha é o componente React:
// src/components/AnaliseResultado.jsx — ele só chama isto e transforma em JSX.
function computeAnalise(casa, vis, camp, filtroAtual){
  if(!casa||!vis) return { estado:'faltam-times' };
  if(casa===vis)  return { estado:'times-iguais' };
  const sC=statsTime(casa,filtroAtual.casa.local,camp,filtroAtual.casa.qty);
  const sV=statsTime(vis, filtroAtual.vis.local, camp,filtroAtual.vis.qty);
  if(sC.nt===0||sV.nt===0) return { estado:'sem-jogos' };
  // Comportamento por Faixa de Força: como cada time se sai historicamente contra
  // adversários do nível do RIVAL de hoje (usa o rank médio próprio de cada um como alvo
  // pro outro — ver aproveitamentoVsFaixaRank acima).
  const faixaC = aproveitamentoVsFaixaRank(sC.calendario, sV.rankMedProprio);
  const faixaV = aproveitamentoVsFaixaRank(sV.calendario, sC.rankMedProprio);
  // Tendência recente (ganhando/perdendo força) em 3 mercados-chave — ver tendenciaMercado() acima.
  const testeVitoria = c => c.mandante ? c.gC>c.gV : c.gV>c.gC;
  const testeOver15  = c => (c.gC+c.gV) >= 2;
  const testeBtts    = c => c.gC>0 && c.gV>0;
  const tendC = { vitoria: tendenciaMercado(sC.calendario, testeVitoria), over15: tendenciaMercado(sC.calendario, testeOver15), btts: tendenciaMercado(sC.calendario, testeBtts) };
  const tendV = { vitoria: tendenciaMercado(sV.calendario, testeVitoria), over15: tendenciaMercado(sV.calendario, testeOver15), btts: tendenciaMercado(sV.calendario, testeBtts) };
  const modoTempo = filtroAtual.modoTempo === 'ht' ? 'ht' : 'ft'; // 'ft' = Resultado Final, 'ht' = Resultado 1º Tempo
  const lambdaC=sC.lambdaIndice||sC.lambdaAjustado||sC.lambda||0.5, lambdaV=sV.lambdaIndice||sV.lambdaAjustado||sV.lambda||0.5;
  const MAX=10;
  function probResultado(lC,lV){
    let pV=0,pE=0,pD=0;
    for(let i=0;i<=MAX;i++) for(let j=0;j<=MAX;j++){ const p=poisson(lC,i)*poisson(lV,j); if(i>j) pV+=p; else if(i===j) pE+=p; else pD+=p; }
    const s=pV+pE+pD; pV=Math.round(pV/s*100); pE=Math.round(pE/s*100); pD=100-pV-pE;
    return { pVit:pV, pEmp:pE, pDer:pD };
  }
  const { pVit, pEmp, pDer } = probResultado(lambdaC, lambdaV);
  function probOver(lC,lV,n){ let u=0; for(let i=0;i<=MAX;i++) for(let j=0;j<=MAX;j++) if(i+j<=n) u+=poisson(lC,i)*poisson(lV,j); return Math.round((1-u)*100); }
  const o15=probOver(lambdaC,lambdaV,1), o25=probOver(lambdaC,lambdaV,2), o35=probOver(lambdaC,lambdaV,3), o45=probOver(lambdaC,lambdaV,4);
  // Gols HT (1º tempo) — só calcula se os dois times tiverem gols de 1º tempo registrados.
  // Mesmas 4 linhas do mercado de gols normal (0.5 a real. o padrão pedido foi até 4.5,
  // mesmo que na prática 3.5+/4.5 no intervalo seja raríssimo — o cálculo é o mesmo probOver).
  const temHT = (sC.ntHT>0 && sV.ntHT>0);
  const o05HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 0) : null;
  const o15HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 1) : null;
  const o25HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 2) : null;
  const o35HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 3) : null;
  const o45HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 4) : null;
  // Resultado (V/E/D) do 1º tempo, pela mesma distribuição de Poisson mas usando o
  // "gols esperados até os 45min" de cada time (lambdaHT) em vez do jogo inteiro.
  const resultadoHT = temHT ? probResultado(sC.lambdaHT, sV.lambdaHT) : null;
  const pMC=1-poisson(lambdaC,0), pMV=1-poisson(lambdaV,0), pBtts=Math.round(pMC*pMV*100);
  // Ambas Marcam no 1º Tempo — mesma fórmula, usando o lambda HT de cada time.
  const pBttsHT = temHT ? Math.round((1-poisson(sC.lambdaHT,0))*(1-poisson(sV.lambdaHT,0))*100) : null;
  const mcc = mercadosCantosCartoes(sC, sV);

  // Salvar globalmente para a calculadora
  ultimaAnalise = {
    casa, vis, liga: camp||'',
    mercados: [
      { nome: 'Vitória Mandante', prob: pVit },
      { nome: 'Empate',           prob: pEmp },
      { nome: 'Vitória Visitante',prob: pDer },
      { nome: 'Over 1.5',       prob: o15  },
      { nome: 'Under 1.5',      prob: 100-o15 },
      { nome: 'Over 2.5',       prob: o25  },
      { nome: 'Under 2.5',      prob: 100-o25 },
      { nome: 'Over 3.5',       prob: o35  },
      { nome: 'Under 3.5',      prob: 100-o35 },
      { nome: 'Over 4.5',       prob: o45  },
      { nome: 'Under 4.5',      prob: 100-o45 },
      ...(temHT ? [
        { nome: 'Gols HT Over 0.5',  prob: o05HT },
        { nome: 'Gols HT Under 0.5', prob: 100-o05HT },
        { nome: 'Gols HT Over 1.5',  prob: o15HT },
        { nome: 'Gols HT Under 1.5', prob: 100-o15HT },
        { nome: 'Gols HT Over 2.5',  prob: o25HT },
        { nome: 'Gols HT Under 2.5', prob: 100-o25HT },
        { nome: 'Gols HT Over 3.5',  prob: o35HT },
        { nome: 'Gols HT Under 3.5', prob: 100-o35HT },
        { nome: 'Vitória Mandante HT', prob: resultadoHT.pVit },
        { nome: 'Empate HT',           prob: resultadoHT.pEmp },
        { nome: 'Vitória Visitante HT',prob: resultadoHT.pDer },
        { nome: 'Ambas Marcam HT',     prob: pBttsHT },
        { nome: 'Ambas Não Marc. HT',  prob: 100-pBttsHT },
      ] : []),
      { nome: 'Ambas Marcam',   prob: pBtts },
      { nome: 'Ambas Não Marc.',prob: 100-pBtts },
      // Cantos e cartões só existem fechados pra partida inteira — no modo 1º Tempo
      // não tem essa informação, então ficam de fora da lista pra não sugerir um
      // mercado sem dado nenhum por trás.
      ...(modoTempo === 'ft' ? [
        ...mcc.cantos.flatMap(c=>[
          { nome: `Cantos Over ${c.linha}`,  prob: c.over },
          { nome: `Cantos Under ${c.linha}`, prob: 100-c.over },
        ]),
        ...mcc.cartoes.flatMap(c=>[
          { nome: `Cartões Over ${c.linha}`,  prob: c.over },
          { nome: `Cartões Under ${c.linha}`, prob: 100-c.over },
        ]),
      ] : []),
    ]
  };
  window.ultimaAnalise = ultimaAnalise; // ponte pro componente React da Calculadora de EV

  const placares=[]; for(let i=0;i<=8;i++) for(let j=0;j<=8;j++) placares.push({g1:i,g2:j,p:poisson(lambdaC,i)*poisson(lambdaV,j)});
  placares.sort((a,b)=>b.p-a.p); const top10=placares.slice(0,10); const maxPP=top10[0]?.p||1;
  // Placar exato do 1º Tempo — mesma distribuição de Poisson, com o lambda HT de cada time.
  let top10HT=null, maxPPHT=null;
  if(temHT){
    const placaresHT=[]; for(let i=0;i<=8;i++) for(let j=0;j<=8;j++) placaresHT.push({g1:i,g2:j,p:poisson(sC.lambdaHT,i)*poisson(sV.lambdaHT,j)});
    placaresHT.sort((a,b)=>b.p-a.p); top10HT=placaresHT.slice(0,10); maxPPHT=top10HT[0]?.p||1;
  }
  const golsComb=[...sC.todosGols,...sV.todosGols];
  const momStats=periodos4.map(p=>({ l:p.l,ico:p.ico,count:golsComb.filter(g=>g.min>=p.s&&g.min<=p.e).length }));
  const picoIdx=momStats.indexOf(momStats.reduce((a,b)=>b.count>a.count?b:a));
  const baixoIdx=momStats.indexOf(momStats.reduce((a,b)=>b.count<a.count?b:a));
  const totalMom=momStats.reduce((a,b)=>a+b.count,0)||1;
  // Momentos prováveis de gol restritos ao 1º tempo — só os 2 primeiros períodos (1-45').
  // Cartões/escanteios não têm minuto registrado, então não dá pra fazer o mesmo pra eles.
  const golsCombHT=golsComb.filter(g=>g.min!=null&&g.min<=45);
  const momStatsHT=periodos4.slice(0,2).map(p=>({ l:p.l,ico:p.ico,count:golsCombHT.filter(g=>g.min>=p.s&&g.min<=p.e).length }));
  const picoIdxHT=momStatsHT.indexOf(momStatsHT.reduce((a,b)=>b.count>a.count?b:a));
  const baixoIdxHT=momStatsHT.indexOf(momStatsHT.reduce((a,b)=>b.count<a.count?b:a));
  const totalMomHT=momStatsHT.reduce((a,b)=>a+b.count,0)||1;

  return {
    estado:'ok', casa, vis, camp,
    filtro: { casa:{...filtroAtual.casa}, vis:{...filtroAtual.vis} }, modoTempo,
    sC, sV, lambdaC, lambdaV, pVit, pEmp, pDer, o15, o25, o35, o45,
    faixaC, faixaV, tendC, tendV,
    temHT, o05HT, o15HT, o25HT, o35HT, o45HT, resultadoHT, pBtts, pBttsHT, mcc, top10, maxPP, top10HT, maxPPHT,
    momStats, golsComb, picoIdx, baixoIdx, totalMom,
    momStatsHT, golsCombHT, picoIdxHT, baixoIdxHT, totalMomHT,
  };
}
window.computeAnalise = computeAnalise;
window.calDot = calDot;
window.calLbl = calLbl;
window.renderMinTabela = renderMinTabela;

// Ponte de compatibilidade: SeletorAnalise.jsx continua chamando window.renderAnalise()
// toda vez que a seleção (time/campeonato/filtro) muda. Antes essa função desenhava HTML
// direto numa div; agora só recalcula (puro) e avisa o componente de resultado React.
function renderAnalise(){
  const casa=document.getElementById('selCasa')?.value||'', vis=document.getElementById('selVis')?.value||'';
  const camp=document.getElementById('selCampAnalise')?.value||'';
  window.analiseResultado = computeAnalise(casa, vis, camp, filtro);
  window.analiseResultadoRefresh?.();
}

// ══ AUX ══
