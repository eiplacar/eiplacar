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
  const lambda=nt?r2(gmTot/nt):0; // ataque, sem ajuste (mantido para comparação)
  const lambdaDef=nt?r2(gsTot/nt):0; // defesa, sem ajuste (gols sofridos por jogo)

  // ── Gols do 1º tempo (HT) — só conta jogos com esse dado preenchido ──
  const jogosComHT = jogos.filter(j=>(j.casa===nome?j.golsHT_C:j.golsHT_V)!=null);
  const ntHT = jogosComHT.length;
  const gmHT = jogosComHT.reduce((s,j)=>s+(j.casa===nome?j.golsHT_C:j.golsHT_V),0);
  const gsHT = jogosComHT.reduce((s,j)=>s+(j.casa===nome?j.golsHT_V:j.golsHT_C),0);
  const lambdaHT    = ntHT?r2(gmHT/ntHT):0;
  const lambdaDefHT = ntHT?r2(gsHT/ntHT):0;

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
  const calendario=jogos.map(j=>({ adv:j.casa===nome?j.vis:j.casa, rank:j.casa===nome?j.rankV:j.rankC, data:j.data, tamCamp:tamanhoCampeonato(j.camp) })).filter(x=>x.rank);
  const todosGols=jogos.flatMap(j=>(j.gols||[]).map(g=>({ min:g.min, marcado:(j.casa===nome&&g.time==='casa')||(j.vis===nome&&g.time==='vis') })));
  const jogosComMin=jogos.filter(j=>(j.gols||[]).length>0).length;
  const minStats=periodos4.map(p=>({ l:p.l, ico:p.ico, marc:todosGols.filter(g=>g.marcado&&g.min>=p.s&&g.min<=p.e).length, sofr:todosGols.filter(g=>!g.marcado&&g.min>=p.s&&g.min<=p.e).length }));

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

  return { nome, nt, nc, nv, local, qty, mediaGM_casa:nc?r2(gmCasa/nc):0, mediaGS_casa:nc?r2(gsCasa/nc):0, mediaGM_vis:nv?r2(gmVis/nv):0, mediaGS_vis:nv?r2(gsVis/nv):0, lambda, lambdaDef, lambdaAjustado, lambdaDefAjustado, lambdaHT, lambdaDefHT, ntHT, lambdaIndice, indiceForca, mediaChutesGolMarc, mediaChutesTotMarc, mediaCantosMarc, mediaVermProprio, mediaAmarProprio, confCantos, confCartoes, confChutes, rankMedAdv, calendario, minStats, jogosComMin, todosGols, mediasGolJogo, mediasMarc, mediasSofr, mediaMinMarc, mediaMinSofr, jogosComGols:jogosComGols.length };
}

// ══ RENDER MOMENTO DE ENTRADA ══
function renderEntrada(sC, sV, casa, vis, camp){
  const temDadosC = sC.jogosComGols > 0;
  const temDadosV = sV.jogosComGols > 0;

  if(!temDadosC && !temDadosV){
    return `<div class="empty"><div class="icon">⏱️</div><p>Nenhum minuto de gol registrado para estes times.<br>Registre os gols com os minutos na aba Cadastrar Jogo.</p></div>`;
  }

  function seqHtml(medias, tipo, label){
    if(!medias.some(m=>m!==null)) return '';
    return `<div class="entrada-card">
      <div class="entrada-header">
        <div class="entrada-titulo">${label}</div>
        <div class="entrada-jogos">${tipo==='marc'?sC.jogosComGols:sC.jogosComGols} jogo(s) c/ minutos</div>
      </div>
      <div class="gol-seq">
        ${medias.map((m,i)=>m!==null?`<div class="gol-seq-item">
          <div class="gsi-num">${i+1}º gol</div>
          <div class="gsi-min ${tipo}">${m}'</div>
          <div class="gsi-sub">média</div>
        </div>`:'').filter(Boolean).join('')}
      </div>
    </div>`;
  }

  // Calcular momento estimado de cada over cruzando os dois times
  // Gol N do jogo = média dos Nº gols combinados dos dois times
  function mediaOver(n){ // n=1 => 1º gol do jogo
    // pegar mediasGolJogo de cada time
    const vC = sC.mediasGolJogo[n-1];
    const vV = sV.mediasGolJogo[n-1];
    if(vC!==null && vV!==null) return r2((vC+vV)/2);
    if(vC!==null) return vC;
    if(vV!==null) return vV;
    return null;
  }

  // Método alternativo: usar média geral marcação+sofrimento dos dois times
  // 1º gol = (mediaMinMarc_C + mediaMinSofr_C + mediaMinMarc_V + mediaMinSofr_V) / 4
  const mC_marc = sC.mediaMinMarc, mC_sofr = sC.mediaMinSofr;
  const mV_marc = sV.mediaMinMarc, mV_sofr = sV.mediaMinSofr;

  // Estimativa do 1º gol por média dos dois times
  const vals1gol = [mC_marc, mC_sofr, mV_marc, mV_sofr].filter(v=>v!==null);
  const est1gol  = vals1gol.length ? r2(vals1gol.reduce((a,b)=>a+b,0)/vals1gol.length) : null;

  // Estimativas dos demais gols (sequência combinada)
  const overMins = [1,2,3,4,5].map(n=>mediaOver(n));

  // Cor por mercado
  const marketInfo = [
    { label:'Over 1.5', idx:1, cls:'verde',   desc:'Aguardar 2º gol' },
    { label:'Over 2.5', idx:2, cls:'amarelo',  desc:'Aguardar 3º gol' },
    { label:'Over 3.5', idx:3, cls:'laranja',  desc:'Aguardar 4º gol' },
    { label:'Over 4.5', idx:4, cls:'perigo',   desc:'Aguardar 5º gol' },
  ];

  const overHtml = marketInfo.map(m=>{
    const min = overMins[m.idx];
    const seguro = min && min > 20;
    return `<div class="oe-box ${m.cls}">
      <div class="oe-market">${m.label}</div>
      <div class="oe-min" style="color:var(--ouro)">${min ? min+"'" : '—'}</div>
      <div class="oe-label">${m.desc}</div>
      ${seguro?`<div class="oe-seguro">✅ Entrada segura</div>`:''}
    </div>`;
  }).join('');

  // Aviso de segurança
  const avisoMin = est1gol ? Math.round(est1gol) : null;

  return `
    <!-- SUMÁRIO DOS DOIS TIMES -->
    <div class="sec">
      <div class="sec-title">🔢 Médias de Minuto — ${casa}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <div class="gol-seq-item" style="flex:1;min-width:80px;background:var(--c2);border:1px solid var(--c3);border-radius:8px;padding:10px;text-align:center">
          <div class="gsi-num">⚽ Marca em média</div>
          <div class="gsi-min marc">${mC_marc!==null?mC_marc+"'":'—'}</div>
          <div class="gsi-sub">${sC.todosGols.filter(g=>g.marcado).length} gols em ${sC.jogosComGols}j</div>
        </div>
        <div class="gol-seq-item" style="flex:1;min-width:80px;background:var(--c2);border:1px solid var(--c3);border-radius:8px;padding:10px;text-align:center">
          <div class="gsi-num">🥅 Sofre em média</div>
          <div class="gsi-min sofr">${mC_sofr!==null?mC_sofr+"'":'—'}</div>
          <div class="gsi-sub">${sC.todosGols.filter(g=>!g.marcado).length} gols em ${sC.jogosComGols}j</div>
        </div>
      </div>
      ${sC.mediasMarc.some(m=>m!==null)?`<div style="font-size:11px;color:var(--texto2);margin-bottom:6px;font-weight:700">Sequência gols marcados:</div>
      <div class="gol-seq">${sC.mediasMarc.map((m,i)=>m!==null?`<div class="gol-seq-item"><div class="gsi-num">${i+1}º</div><div class="gsi-min marc">${m}'</div></div>`:'').filter(Boolean).join('')}</div>`:''}
      ${sC.mediasSofr.some(m=>m!==null)?`<div style="font-size:11px;color:var(--texto2);margin-bottom:6px;font-weight:700;margin-top:8px">Sequência gols sofridos:</div>
      <div class="gol-seq">${sC.mediasSofr.map((m,i)=>m!==null?`<div class="gol-seq-item"><div class="gsi-num">${i+1}º</div><div class="gsi-min sofr">${m}'</div></div>`:'').filter(Boolean).join('')}</div>`:''}
    </div>

    <div class="sec">
      <div class="sec-title">🔢 Médias de Minuto — ${vis}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <div class="gol-seq-item" style="flex:1;min-width:80px;background:var(--c2);border:1px solid var(--c3);border-radius:8px;padding:10px;text-align:center">
          <div class="gsi-num">⚽ Marca em média</div>
          <div class="gsi-min marc">${mV_marc!==null?mV_marc+"'":'—'}</div>
          <div class="gsi-sub">${sV.todosGols.filter(g=>g.marcado).length} gols em ${sV.jogosComGols}j</div>
        </div>
        <div class="gol-seq-item" style="flex:1;min-width:80px;background:var(--c2);border:1px solid var(--c3);border-radius:8px;padding:10px;text-align:center">
          <div class="gsi-num">🥅 Sofre em média</div>
          <div class="gsi-min sofr">${mV_sofr!==null?mV_sofr+"'":'—'}</div>
          <div class="gsi-sub">${sV.todosGols.filter(g=>!g.marcado).length} gols em ${sV.jogosComGols}j</div>
        </div>
      </div>
      ${sV.mediasMarc.some(m=>m!==null)?`<div style="font-size:11px;color:var(--texto2);margin-bottom:6px;font-weight:700">Sequência gols marcados:</div>
      <div class="gol-seq">${sV.mediasMarc.map((m,i)=>m!==null?`<div class="gol-seq-item"><div class="gsi-num">${i+1}º</div><div class="gsi-min marc">${m}'</div></div>`:'').filter(Boolean).join('')}</div>`:''}
      ${sV.mediasSofr.some(m=>m!==null)?`<div style="font-size:11px;color:var(--texto2);margin-bottom:6px;font-weight:700;margin-top:8px">Sequência gols sofridos:</div>
      <div class="gol-seq">${sV.mediasSofr.map((m,i)=>m!==null?`<div class="gol-seq-item"><div class="gsi-num">${i+1}º</div><div class="gsi-min sofr">${m}'</div></div>`:'').filter(Boolean).join('')}</div>`:''}
    </div>

    <!-- MOMENTO DE ENTRADA POR MERCADO -->
    <div class="sec">
      <div class="sec-title">🚦 Momento Ideal de Entrada</div>
      ${est1gol!==null?`<div style="background:var(--c2);border:1px solid var(--verde2);border-radius:10px;padding:12px;text-align:center;margin-bottom:12px">
        <div style="font-size:11px;color:var(--texto2);margin-bottom:4px">⏱️ Estimativa do 1º gol do jogo</div>
        <div style="font-size:36px;font-weight:900;color:var(--ouro)">${est1gol}'</div>
        <div style="font-size:11px;color:var(--texto2);margin-top:4px">média entre marcação e sofrimento dos dois times</div>
      </div>`:''}
      <div class="over-entrada">${overHtml}</div>
      ${avisoMin&&avisoMin>20?`<div class="aviso-entrada">
        💡 <strong>Ponto de segurança:</strong> com base nos dados, o 1º gol costuma sair após o <strong>${avisoMin}º minuto</strong>.<br>
        Entrar antes disso aumenta o risco. Aguardar a confirmação antes de apostar em Over é mais conservador.
      </div>`:''}
      <div style="font-size:10px;color:var(--texto2);margin-top:10px;line-height:1.7">
        ⚠️ Baseado em médias históricas. Quanto mais jogos com minutos registrados, maior a precisão.<br>
        ${sC.jogosComGols}j com min. (${casa}) · ${sV.jogosComGols}j com min. (${vis})
      </div>
    </div>
  `;
}

// Estado global das probabilidades calculadas
let ultimaAnalise = null;

// ══ TABELA DE MINUTOS DOS GOLS (usada na sub-aba Estatísticas) ══
// Continua devolvendo um pedaço de HTML pronto (é só uma tabelinha visual, sem
// lógica de negócio) — o componente React injeta isso com dangerouslySetInnerHTML,
// igual já se fazia com escudos de time.
function renderMinTabela(s){
  if(!s.jogosComMin) return `<div class="empty" style="padding:16px"><div class="icon" style="font-size:24px">⏱️</div><p>Sem minutos de gols registrados.</p></div>`;
  const picoM=s.minStats.indexOf(s.minStats.reduce((a,b)=>b.marc>a.marc?b:a));
  const picoS=s.minStats.indexOf(s.minStats.reduce((a,b)=>b.sofr>a.sofr?b:a));
  const totMarc=s.minStats.reduce((a,b)=>a+b.marc,0);
  const totSofr=s.minStats.reduce((a,b)=>a+b.sofr,0);
  const cards=s.minStats.map((p,i)=>{
    const isPicoM=(i===picoM), isPicoS=(i===picoS);
    const cls=isPicoM?'pico-marc':isPicoS?'pico-sofr':'';
    const tag=isPicoM?'<div class="pc-tag">⚽ Pico Marc.</div>':isPicoS?'<div class="pc-tag">🥅 Pico Sofr.</div>':'';
    return `<div class="periodo-card ${cls}">
      <div class="pc-label">${p.l}</div>
      <div class="pc-row"><span class="pc-ico">⚽</span><span class="pc-val marc">${p.marc}</span></div>
      <div class="pc-row"><span class="pc-ico">🥅</span><span class="pc-val sofr">${p.sofr}</span></div>
      ${tag}
    </div>`;
  }).join('');
  return `<div class="periodo-cards">${cards}</div>
  <div class="min-insight" style="margin-top:10px">
    ⚽ Total marcados: <strong>${totMarc}</strong> &nbsp;·&nbsp; 🥅 Total sofridos: <strong>${totSofr}</strong><br>
    Marca mais: <strong>${s.minStats[picoM].l}</strong> &nbsp;·&nbsp; Sofre mais: <strong>${s.minStats[picoS].l}</strong><br>
    <span style="color:var(--texto2)">${s.jogosComMin} jogo(s) com minutos registrados</span>
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
  const lambdaC=sC.lambdaIndice||sC.lambdaAjustado||sC.lambda||0.5, lambdaV=sV.lambdaIndice||sV.lambdaAjustado||sV.lambda||0.5;
  let pVit=0,pEmp=0,pDer=0; const MAX=10;
  for(let i=0;i<=MAX;i++) for(let j=0;j<=MAX;j++){ const p=poisson(lambdaC,i)*poisson(lambdaV,j); if(i>j) pVit+=p; else if(i===j) pEmp+=p; else pDer+=p; }
  const s=pVit+pEmp+pDer; pVit=Math.round(pVit/s*100); pEmp=Math.round(pEmp/s*100); pDer=100-pVit-pEmp;
  function probOver(lC,lV,n){ let u=0; for(let i=0;i<=MAX;i++) for(let j=0;j<=MAX;j++) if(i+j<=n) u+=poisson(lC,i)*poisson(lV,j); return Math.round((1-u)*100); }
  const o15=probOver(lambdaC,lambdaV,1), o25=probOver(lambdaC,lambdaV,2), o35=probOver(lambdaC,lambdaV,3), o45=probOver(lambdaC,lambdaV,4);
  // Gols HT (1º tempo) — só calcula se os dois times tiverem gols de 1º tempo registrados
  const temHT = (sC.ntHT>0 && sV.ntHT>0);
  const o05HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 0) : null;
  const o15HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 1) : null;
  const pMC=1-poisson(lambdaC,0), pMV=1-poisson(lambdaV,0), pBtts=Math.round(pMC*pMV*100);
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
      ] : []),
      { nome: 'Ambas Marcam',   prob: pBtts },
      { nome: 'Ambas Não Marc.',prob: 100-pBtts },
      ...mcc.cantos.flatMap(c=>[
        { nome: `Cantos Over ${c.linha}`,  prob: c.over },
        { nome: `Cantos Under ${c.linha}`, prob: 100-c.over },
      ]),
      ...mcc.cartoes.flatMap(c=>[
        { nome: `Cartões Over ${c.linha}`,  prob: c.over },
        { nome: `Cartões Under ${c.linha}`, prob: 100-c.over },
      ]),
    ]
  };
  window.ultimaAnalise = ultimaAnalise; // ponte pro componente React da Calculadora de EV

  const placares=[]; for(let i=0;i<=8;i++) for(let j=0;j<=8;j++) placares.push({g1:i,g2:j,p:poisson(lambdaC,i)*poisson(lambdaV,j)});
  placares.sort((a,b)=>b.p-a.p); const top10=placares.slice(0,10); const maxPP=top10[0]?.p||1;
  const golsComb=[...sC.todosGols,...sV.todosGols];
  const momStats=periodos4.map(p=>({ l:p.l,ico:p.ico,count:golsComb.filter(g=>g.min>=p.s&&g.min<=p.e).length }));
  const picoIdx=momStats.indexOf(momStats.reduce((a,b)=>b.count>a.count?b:a));
  const baixoIdx=momStats.indexOf(momStats.reduce((a,b)=>b.count<a.count?b:a));
  const totalMom=momStats.reduce((a,b)=>a+b.count,0)||1;

  return {
    estado:'ok', casa, vis, camp,
    filtro: { casa:{...filtroAtual.casa}, vis:{...filtroAtual.vis} },
    sC, sV, lambdaC, lambdaV, pVit, pEmp, pDer, o15, o25, o35, o45,
    temHT, o05HT, o15HT, pBtts, mcc, top10, maxPP,
    momStats, golsComb, picoIdx, baixoIdx, totalMom,
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
