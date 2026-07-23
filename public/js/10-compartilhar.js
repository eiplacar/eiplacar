// ═══════════════════════════════════════════════════
// COMPARTILHAMENTO — modal genérico usado por Análise, Jogos do Dia e Sinal de Entrada
// ═══════════════════════════════════════════════════
// ══ COMPARTILHAR ══
function compartilhar(){
  const casa = document.getElementById('selCasa').value;
  const vis  = document.getElementById('selVis').value;
  if(!casa||!vis){ toast('⚠️ Selecione os dois times primeiro'); return; }
  document.getElementById('inputDataJogo').value = '';
  document.getElementById('modalDataJogo').classList.add('open');
}

function fecharModalDataJogo(){
  document.getElementById('modalDataJogo').classList.remove('open');
}

function confirmarCompartilhar(){
  const dataJogo = document.getElementById('inputDataJogo').value;
  fecharModalDataJogo();

  const casa = document.getElementById('selCasa').value;
  const vis  = document.getElementById('selVis').value;
  if(!casa||!vis){ toast('⚠️ Selecione os dois times primeiro'); return; }
  const camp = document.getElementById('selCampAnalise')?.value||'';
  const sC = statsTime(casa, filtro.casa.local, camp, filtro.casa.qty);
  const sV = statsTime(vis,  filtro.vis.local,  camp, filtro.vis.qty);
  const lambdaC = sC.lambdaIndice||sC.lambdaAjustado||sC.lambda||0.5, lambdaV = sV.lambdaIndice||sV.lambdaAjustado||sV.lambda||0.5;
  const MAX=10;
  function probOver(lC,lV,n){ let u=0; for(let i=0;i<=MAX;i++) for(let j=0;j<=MAX;j++) if(i+j<=n) u+=poisson(lC,i)*poisson(lV,j); return Math.round((1-u)*100); }
  let pV=0,pE=0,pD=0;
  for(let i=0;i<=MAX;i++) for(let j=0;j<=MAX;j++){ const p=poisson(lambdaC,i)*poisson(lambdaV,j); if(i>j) pV+=p; else if(i===j) pE+=p; else pD+=p; }
  const s=pV+pE+pD; pV=Math.round(pV/s*100); pE=Math.round(pE/s*100); pD=100-pV-pE;
  const o15=probOver(lambdaC,lambdaV,1), o25=probOver(lambdaC,lambdaV,2), o35=probOver(lambdaC,lambdaV,3), o45=probOver(lambdaC,lambdaV,4);
  const temHT = (sC.ntHT>0 && sV.ntHT>0);
  const o05HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 0) : null;
  const o15HT = temHT ? probOver(sC.lambdaHT, sV.lambdaHT, 1) : null;
  const pBtts=Math.round((1-poisson(lambdaC,0))*(1-poisson(lambdaV,0))*100);
  const mcc = mercadosCantosCartoes(sC, sV);
  const placares=[];
  for(let i=0;i<=6;i++) for(let j=0;j<=6;j++) placares.push({g1:i,g2:j,p:poisson(lambdaC,i)*poisson(lambdaV,j)});
  placares.sort((a,b)=>b.p-a.p);
  const top3=placares.slice(0,3);

  // Minuto médio histórico da liga (do confronto selecionado), só quando há campeonato definido
  let blocoMinutos = [];
  if(camp){
    const linhasOver = [1.5, 2.5, 3.5, 4.5];
    const linhasMin = [];
    linhasOver.forEach(linha=>{
      const r = calcularTempoGolLiga(camp, linha);
      if(r.t1) linhasMin.push(`Over ${linha} minuto ${r.t1.mediaPrimeiro}' (amostra ${r.t1.pct}%)`);
    });
    if(linhasMin.length){
      blocoMinutos = [`⏱️ *ENTRADA EM LIVE*`, ...linhasMin, ``];
    }
  }

  const txt = [
    `⚽ *${camp || 'Análise'}*`,
    ...(dataJogo && dataJogo.trim() ? [`🗓️ ${dataJogo.trim()}`] : []),
    `${casa} × ${vis}`,
    ``,
    `🏆 *RESULTADO*`,
    `${casa}: ${pV}%`,
    `Empate: ${pE}%`,
    `${vis}: ${pD}%`,
    ``,
    `⚽ *MERCADO DE GOLS*`,
    `Over 1.5: ${o15}% | Under: ${100-o15}%`,
    `Over 2.5: ${o25}% | Under: ${100-o25}%`,
    `Over 3.5: ${o35}% | Under: ${100-o35}%`,
    `Over 4.5: ${o45}% | Under: ${100-o45}%`,
    ``,
    ...(temHT ? [
      `⚽ *MERCADO DE GOLS HT*`,
      `Over 0.5 HT: ${o05HT}% | Under: ${100-o05HT}%`,
      `Over 1.5 HT: ${o15HT}% | Under: ${100-o15HT}%`,
      ``,
    ] : []),
    `🤝 *AMBAS MARCAM*`,
    `Sim: ${pBtts}% | Não: ${100-pBtts}%`,
    ``,
    ...(mcc.temCantos && mcc.confCantos>=70 ? [
      `🚩 *MERCADO DE CANTOS* (confiança dos dados ${mcc.confCantos}%)`,
      ...mcc.cantos.map(c=>`Over ${c.linha}: ${c.over}% | Under: ${100-c.over}%`),
      ``,
    ] : []),
    ...(mcc.temCartoes && mcc.confCartoes>=70 ? [
      `🟨 *MERCADO DE CARTÕES* (confiança dos dados ${mcc.confCartoes}%)`,
      ...mcc.cartoes.map(c=>`Over ${c.linha}: ${c.over}% | Under: ${100-c.over}%`),
      ``,
    ] : []),
    `🎯 *TOP 3 PLACAR EXATO*`,
    ...top3.map(p=>`${p.g1}–${p.g2}: ${Math.round(p.p*1000)/10}%`),
    ``,
    ...blocoMinutos,
    `Gerado por Ei Placar`,
  ].filter((l,i,arr)=> !(l===''&&arr[i+1]==='')).join('\n').trim();

  abrirCompartilhamento(txt, `${casa} × ${vis}`);
}
function copiarTexto(txt){
  function copiaAntiga(){
    try{
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if(ok) toast('📋 Copiado! Cole onde quiser');
      else toast('⚠️ Não foi possível copiar');
    }catch{
      toast('⚠️ Não foi possível copiar');
    }
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt)
      .then(()=>toast('📋 Copiado! Cole onde quiser'))
      .catch(copiaAntiga);
  } else {
    copiaAntiga();
  }
}

// ══ COMPARTILHAR ══
// Compartilha direto: usa o menu nativo do celular (WhatsApp, Telegram, o que tiver
// instalado) quando disponível. Sem isso (ex: computador), copia o texto e avisa.
function abrirCompartilhamento(txt, titulo){
  if(navigator.share){
    navigator.share({ title: titulo||'Ei Placar', text: txt }).catch(()=>{});
  } else {
    copiarTexto(txt);
    toast('📋 Texto copiado! Cole onde quiser compartilhar.');
  }
}

