// ═══════════════════════════════════════════════════
// ÍNDICE (Favorita Ponto) — 3ª sub-aba de Análise, ao lado de Probabilidade e
// Estatísticas. Não recalcula nada do zero: pega o resultado que
// computeAnalise() (09-analise.js) já calculou e cruza os indicadores com
// peso, gerando 3 pontuações independentes — Resultado, Gols e BTTS — em vez
// de misturar tudo numa nota só.
//
// A ideia (e os pesos) vieram de uma conversa sobre como cruzar Probabilidade
// (Poisson) com Estatísticas (forma, calendário, adversários parecidos etc)
// sem deixar um indicador fraco (tipo BTTS) pesar igual a um forte (tipo
// desempenho contra adversário parecido). Cada indicador vira um "ponto" de
// -1 (favorece o visitante) a +1 (favorece o mandante), multiplicado pelo
// peso dele — se faltar dado pra um indicador, ele simplesmente não entra na
// conta (nem no peso total), em vez de contar como neutro artificialmente.
// ═══════════════════════════════════════════════════

// clip(-1..1) — trava o valor num intervalo, pra nenhum indicador sozinho dominar a conta
function clip1(v){ return Math.max(-1, Math.min(1, v)); }
function clip100(v){ return Math.max(0, Math.min(100, Math.round(v))); }

// Nível de dificuldade médio do calendário de um time (0=só fáceis, 1=só difíceis) —
// usa os últimos N jogos do calendário (já vem ordenado do mais recente pro mais antigo).
function dificuldadeMediaCalendario(calendario, n=10){
  const validos = calendario.filter(c=>c.rank!=null && c.tamCamp).slice(0, n);
  if(!validos.length) return null;
  const soma = validos.reduce((s,c)=>{
    const nivel = calNivel(c.rank, c.tamCamp);
    return s + (nivel==='dificil'?1:nivel==='medio'?0.5:0);
  }, 0);
  return soma/validos.length;
}

// Aproveitamento em % (V=3pts, E=1pt) de um placar V/E/D
function aproveitamentoVED(ved){
  const jg = ved.v+ved.e+ved.d;
  return jg ? ((ved.v*3+ved.e)/(jg*3))*100 : null;
}

// Momentum de tendência (subindo/estável/descendo) em número: +1/0/-1
function momentum(t){
  if(!t) return null;
  return t.tendencia==='subindo' ? 1 : t.tendencia==='descendo' ? -1 : 0;
}

// ══ 🏆 ÍNDICE — RESULTADO (Favorita Ponto) ══
// Cada indicador devolve { peso, valor (-1..1, +1=favorece casa) } — ou null se não
// tiver dado suficiente pra calcular (nesse caso ele é descartado da conta inteira,
// peso incluso, em vez de virar um "empate" artificial que dilui os outros).
function indicadoresResultado(data){
  const { sC, sV, faixaC, faixaV, tendC, tendV, pVit, pDer, lambdaC, lambdaV, momStats, totalMom } = data;
  const ind = [];

  // Peso 3 — Desempenho contra adversários de força similar
  if(faixaC && faixaV){
    ind.push({ nome:'Adversários similares', peso:3, valor: clip1((faixaC.aproveitamento - faixaV.aproveitamento)/100) });
  }
  // Peso 3 — Casa/Fora (aproveitamento do mandante em casa vs visitante fora)
  const apCasa = aproveitamentoVED(sC.vedCasa), apFora = aproveitamentoVED(sV.vedFora);
  if(apCasa!=null && apFora!=null){
    ind.push({ nome:'Casa/Fora', peso:3, valor: clip1((apCasa - apFora)/100) });
  }
  // Peso 3 — Forma recente (últimos 10, % de vitórias)
  if(tendC.vitoria && tendV.vitoria){
    ind.push({ nome:'Forma recente', peso:3, valor: clip1((tendC.vitoria.pct10 - tendV.vitoria.pct10)/100) });
  }
  // Peso 3 — Força do calendário (quem jogou contra adversários mais difíceis leva o ponto —
  // serve pra não supervalorizar um retrospecto conquistado contra times fracos)
  const difC = dificuldadeMediaCalendario(sC.calendario), difV = dificuldadeMediaCalendario(sV.calendario);
  if(difC!=null && difV!=null){
    ind.push({ nome:'Força do calendário', peso:3, valor: clip1(difC - difV) });
  }
  // Peso 2 — Probabilidade do resultado (Poisson)
  ind.push({ nome:'Probabilidade do modelo', peso:2, valor: clip1((pVit - pDer)/100) });
  // Peso 2 — Força ofensiva λ
  if(lambdaC+lambdaV > 0){
    ind.push({ nome:'Força ofensiva λ', peso:2, valor: clip1((lambdaC - lambdaV)/(lambdaC+lambdaV)) });
  }
  // Peso 2 — Tendência de resultados (ganhando/perdendo força)
  const momC = momentum(tendC.vitoria), momV = momentum(tendV.vitoria);
  if(momC!=null && momV!=null){
    ind.push({ nome:'Tendência de resultados', peso:2, valor: clip1((momC - momV)/2) });
  }
  // Peso 1 — Tendência de gols (Over 1.5 de cada time)
  if(tendC.over15 && tendV.over15){
    ind.push({ nome:'Tendência de gols', peso:1, valor: clip1((tendC.over15.pct10 - tendV.over15.pct10)/100) });
  }
  // Peso 1 — Minutos dos gols: quem produz mais no fim (66-90+) E sofre menos no início (1-20')
  if(totalMom>0 && sC.jogosComMin>0 && sV.jogosComMin>0){
    const finalC = (sC.minStats[3].marc)/(sC.jogosComMin||1), finalV = (sV.minStats[3].marc)/(sV.jogosComMin||1);
    const inicioSofrC = (sC.minStats[0].sofr)/(sC.jogosComMin||1), inicioSofrV = (sV.minStats[0].sofr)/(sV.jogosComMin||1);
    const scoreC = finalC - inicioSofrC, scoreV = finalV - inicioSofrV;
    ind.push({ nome:'Minutos dos gols', peso:1, valor: clip1((scoreC - scoreV)/1.5) });
  }

  return ind;
}

function classificar(pontuacao){
  if(pontuacao>=80) return 'Muito forte';
  if(pontuacao>=70) return 'Forte';
  if(pontuacao>=60) return 'Favorável';
  if(pontuacao>=50) return 'Moderado';
  if(pontuacao>=40) return 'Baixo';
  return 'Muito baixo';
}
// Banda específica pra linhas de Over (Gols) — pedida à parte, mais rígida que a de cima
function classificarLinha(pct){
  if(pct>=75) return { label:'Forte',          cor:'var(--verde2)' };
  if(pct>=60) return { label:'Favorável',       cor:'var(--verde2)' };
  if(pct>=45) return { label:'Moderado',        cor:'var(--ouro)' };
  if(pct>=30) return { label:'Arriscado',       cor:'var(--perigo)' };
  return              { label:'Muito arriscado', cor:'var(--perigo)' };
}

function computeIndiceResultado(data){
  const { casa, vis, pVit, pDer } = data;
  const indicadores = indicadoresResultado(data);
  if(!indicadores.length) return null;
  const somaCasa = indicadores.reduce((s,i)=>s + i.peso*Math.max(0,i.valor), 0);
  const somaVis  = indicadores.reduce((s,i)=>s + i.peso*Math.max(0,-i.valor), 0);
  const pesoTotal = indicadores.reduce((s,i)=>s+i.peso, 0);
  const favoritoEhCasa = somaCasa >= somaVis;
  const favorito = somaCasa===somaVis ? null : (favoritoEhCasa ? casa : vis);
  // Pontuação 0-100: 50 = empate técnico; quanto maior a diferença ponderada, mais perto de 100
  const diferenca = Math.abs(somaCasa - somaVis);
  const pontuacao = clip100(50 + (pesoTotal ? (diferenca/pesoTotal) : 0) * 50);
  // Alerta: a Favorita Ponto (indicadores de desempenho) aponta um time, mas o modelo
  // probabilístico (Poisson puro) aponta o outro — vale destacar essa divergência.
  const favModelo = pVit>pDer ? casa : pDer>pVit ? vis : null;
  const alerta = favorito && favModelo && favorito!==favModelo;
  return {
    favorito, pontuacao, classificacao: classificar(pontuacao),
    alerta, favModelo,
    indicadores: indicadores.map(i=>({ nome:i.nome, peso:i.peso, favorece: i.valor>0.05?casa:i.valor<-0.05?vis:'—' })),
  };
}

// ══ ⚽ ÍNDICE — GOLS ══
function computeIndiceGols(data){
  const { sC, sV, lambdaC, lambdaV, o15, o25, o35, o45, tendC, tendV, momStats, totalMom, top10 } = data;
  const ligaGols = (window.jogosCache?.length ? (window.jogosCache.reduce((s,j)=>s+(j.gC||0)+(j.gV||0),0) / (window.jogosCache.length*2)) : 2.6) || 2.6;

  const scoreOver15 = o15, scoreOver25 = o25;
  const lambdaComb = lambdaC+lambdaV;
  const scoreLambda = clip100((lambdaComb/(ligaGols*2))*100);
  const scoreMedia = clip100(((sC.lambda+sV.lambda)/(ligaGols))*50);
  const momC = momentum(tendC.over15), momV = momentum(tendV.over15);
  const scoreTendencia = (momC!=null && momV!=null) ? clip100(50 + ((momC+momV)/2)*25) : 50;
  const scoreMomentos = totalMom>0 ? clip100((momStats[3].count/totalMom)*100) : 50;
  const somaTop10 = top10.reduce((s,p)=>s+p.p,0) || 1;
  const scorePlacar = clip100((top10.filter(p=>p.g1+p.g2>=3).reduce((s,p)=>s+p.p,0)/somaTop10)*100);

  const comps = [
    { peso:3, score:scoreOver15 }, { peso:3, score:scoreOver25 }, { peso:3, score:scoreLambda },
    { peso:2, score:scoreMedia }, { peso:2, score:scoreTendencia },
    { peso:1, score:scoreMomentos }, { peso:1, score:scorePlacar },
  ];
  const pesoTotal = comps.reduce((s,c)=>s+c.peso,0);
  const pontuacao = clip100(comps.reduce((s,c)=>s+c.peso*c.score,0)/pesoTotal);

  const linhas = [
    { linha:'1.5', prob:o15 }, { linha:'2.5', prob:o25 }, { linha:'3.5', prob:o35 }, { linha:'4.5', prob:o45 },
  ].map(l=>({ ...l, ...classificarLinha(l.prob) }));
  // As 2 linhas de gols mais bem pontuadas (maior probabilidade primeiro) — cada uma
  // com a própria pontuação, em vez de escolher só "a principal" e esconder a 2ª melhor.
  const top2 = [...linhas].sort((a,b)=>b.prob-a.prob).slice(0,2);

  return { pontuacao, classificacao: classificar(pontuacao), linhas, top2 };
}

// ══ 🤝 ÍNDICE — BTTS ══
function computeIndiceBtts(data){
  const { sC, sV, lambdaC, lambdaV, pBtts, tendC, tendV, momStats, totalMom } = data;

  const scoreBtts10 = (tendC.btts && tendV.btts) ? (tendC.btts.pct10+tendV.btts.pct10)/2 : pBtts;
  const scoreBtts5  = (tendC.btts && tendV.btts) ? (tendC.btts.pct5+tendV.btts.pct5)/2 : pBtts;
  const scoreGolsMarc = clip100(((sC.lambda+sV.lambda)/3)*100);
  const scoreGolsSofr = clip100(((sC.lambdaDef+sV.lambdaDef)/3)*100);
  const scoreLambdaOf = pBtts;
  const scoreCasaFora = clip100(((sC.mediaGM_casa+sC.mediaGS_casa+sV.mediaGM_vis+sV.mediaGS_vis)/4)*33);
  const scoreDistribuicao = totalMom>0 ? clip100(100 - (momStats[3].count/totalMom)*100) : 50;

  const comps = [
    { peso:3, score:scoreBtts10 }, { peso:3, score:scoreBtts5 },
    { peso:2, score:scoreGolsMarc }, { peso:2, score:scoreGolsSofr }, { peso:2, score:scoreLambdaOf }, { peso:2, score:scoreCasaFora },
    { peso:1, score:scoreDistribuicao },
  ];
  const pesoTotal = comps.reduce((s,c)=>s+c.peso,0);
  const pontuacao = clip100(comps.reduce((s,c)=>s+c.peso*c.score,0)/pesoTotal);

  return { pontuacao, classificacao: classificar(pontuacao), pctSim: pBtts };
}

// ══ Junta os 3 índices ══
function computeIndice(data){
  if(!data || data.estado!=='ok') return null;
  return {
    resultado: computeIndiceResultado(data),
    gols: computeIndiceGols(data),
    btts: computeIndiceBtts(data),
  };
}
window.computeIndice = computeIndice;

// ══ Favoritar (salva na nuvem, PRIVADO por conta, some 4h depois — igual expiração dos Jogos Agendados) ══
function sbUrlFavoritos(filtros){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/favoritos_indice' + (filtros || '');
}
let favIndiceCache = [];
async function favIndiceCarregarNuvem(){
  if (typeof temConfig !== 'function' || !temConfig()) return;
  try {
    const res = await fetch(sbUrlFavoritos('?order=criado_em.desc'), { headers: sbHeaders() });
    if(!res.ok) return;
    favIndiceCache = await res.json();
  } catch { /* falha silenciosa, tenta de novo depois */ }
}
function favIndiceExpirado(f){
  if(!f.criado_em) return false;
  return (new Date() - new Date(f.criado_em)) > 4*60*60*1000; // 4h depois de favoritado
}
function favIndiceAtivos(){ return favIndiceCache.filter(f=>!favIndiceExpirado(f)); }

async function favoritarIndice(data, idx){
  if(!data || data.estado!=='ok' || !idx) return 'erro';
  if(!perfilAtual?.id) return 'erro';
  const payload = {
    camp: data.camp||'', casa: data.casa, vis: data.vis,
    resultado_favorito: idx.resultado?.favorito||null,
    resultado_pontuacao: idx.resultado?.pontuacao??null,
    resultado_classificacao: idx.resultado?.classificacao||null,
    resultado_alerta: !!idx.resultado?.alerta,
    gols_pontuacao: idx.gols?.pontuacao??null,
    gols_classificacao: idx.gols?.classificacao||null,
    gols_linha1: idx.gols?.top2?.[0]?.linha||null,
    gols_prob1: idx.gols?.top2?.[0]?.prob??null,
    gols_linha2: idx.gols?.top2?.[1]?.linha||null,
    gols_prob2: idx.gols?.top2?.[1]?.prob??null,
    btts_pontuacao: idx.btts?.pontuacao??null,
    btts_classificacao: idx.btts?.classificacao||null,
    btts_pct: idx.btts?.pctSim??null,
    criado_por: perfilAtual.id, // RLS exige criado_por = auth.uid() — favoritos são privados por conta
  };
  try {
    const res = await fetch(sbUrlFavoritos(), {
      method:'POST', headers: { ...sbHeaders(), 'Prefer':'return=representation' }, body: JSON.stringify(payload)
    });
    if(!res.ok){ console.error(await res.text()); return 'erro'; }
    const inserido = (await res.json())[0];
    favIndiceCache.unshift(inserido);
    return inserido;
  } catch(e){ console.error(e); return 'erro'; }
}
async function removerFavoritoIndice(id){
  const antes = favIndiceCache.slice();
  favIndiceCache = favIndiceCache.filter(f=>f.id!==id);
  window.favIndiceRefresh?.();
  try {
    const res = await fetch(sbUrlFavoritos('?id=eq.'+id), { method:'DELETE', headers: sbHeaders() });
    if(!res.ok) throw new Error(await res.text());
  } catch(e){
    favIndiceCache = antes; // desfaz se der erro (ex: RLS recusou por não ser dono nem organizador)
    window.favIndiceRefresh?.();
    toast?.('Erro ao remover: ' + e.message, true);
  }
}
window.favIndiceCarregarNuvem = favIndiceCarregarNuvem;
window.favIndiceAtivos = favIndiceAtivos;
window.favoritarIndice = favoritarIndice;
window.removerFavoritoIndice = removerFavoritoIndice;

// Carrega ao abrir o app e atualiza sozinho (mesmo intervalo do resto do app)
favIndiceCarregarNuvem();
setInterval(()=>{ favIndiceCarregarNuvem().then(()=>window.favIndiceRefresh?.()); }, 60000);
