// ═══════════════════════════════════════════════════
// ABA GERAL — dashboard, cards de campeonato, últimos resultados, modal de detalhe
// ═══════════════════════════════════════════════════
// ══ RENDER GERAL ══
function renderGeral(){
  const campSel = window.campGeral || '';
  const timeSel = window.timeGeral || '';
  const jogosCamp = campSel ? jogosCache.filter(j=>j.camp===campSel) : [];
  const jogos = timeSel ? jogosCamp.filter(j=>j.casa===timeSel||j.vis===timeSel) : jogosCamp;

  // ── Grade de campeonatos: sempre atualizada, é o ponto de entrada da página ──
  const cMap={}; jogosCache.forEach(j=>cMap[j.camp]=(cMap[j.camp]||0)+1);
  const ordemCamps = comEspeciaisPorUltimo(gruposCampeonato(Object.keys(cMap)).flatMap(g=>g.itens));
  const ent = ordemCamps.map(n=>[n,cMap[n]]);
  document.getElementById('campList').innerHTML = ent.length
    ? `<div class="camp-list">${ent.map(([n,c])=>`<div class="camp-row" onclick="filtrarCamp('${n}')"><div class="camp-ic">🏆</div><div class="camp-nome">${n}</div><div class="camp-sub">${c} jogo${c===1?'':'s'}</div></div>`).join('')}</div>`
    : `<div class="empty"><div class="icon">🏆</div><p>Sem campeonatos ainda.</p></div>`;

  if(!campSel){
    document.getElementById('cardCamps').style.display='';
    document.getElementById('geralCampSelecionado').style.display='none';
    return;
  }

  // ── Campeonato selecionado: esconde a grade, mostra as estatísticas só dele (ou só de 1 time, se filtrado) ──
  document.getElementById('cardCamps').style.display='none';
  document.getElementById('ophListaCardDash').style.display='none';
  document.getElementById('geralCampSelecionado').style.display='block';
  document.getElementById('geralCampNome').textContent = '🏆 '+campSel;

  // Filtro de time: lista todo mundo que jogou nesse campeonato
  const timesCamp = [...new Set([...jogosCamp.map(j=>j.casa), ...jogosCamp.map(j=>j.vis)])].sort();
  const selTime = document.getElementById('filtroTimeGeral');
  if(selTime){
    if(selTime.dataset.camp !== campSel || selTime.options.length - 1 !== timesCamp.length){
      selTime.innerHTML = '<option value="">Todos os times</option>' + timesCamp.map(t=>`<option value="${t}">${t}</option>`).join('');
      selTime.dataset.camp = campSel;
    }
    selTime.value = timesCamp.includes(timeSel) ? timeSel : '';
  }

  const total=jogos.length;
  const gols=jogos.reduce((s,j)=>s+(j.gC||0)+(j.gV||0),0);
  const bttsTotal=jogos.filter(j=>j.gC>0&&j.gV>0).length;
  document.getElementById('sTotal').textContent=total;
  document.getElementById('sGols').textContent=gols;
  document.getElementById('sBtts').textContent=bttsTotal;
  document.getElementById('sMedia').textContent=total?(gols/total).toFixed(1):'0.0';

  // Com time selecionado: "Mandante"/"Visitante" passam a ser as vitórias DESSE time jogando em casa/fora.
  // Sem time selecionado: continuam sendo vitórias do mandante/visitante do campeonato como um todo.
  const vit = timeSel ? jogos.filter(j=>j.casa===timeSel&&j.gC>j.gV).length : jogos.filter(j=>j.gC>j.gV).length;
  const emp = jogos.filter(j=>j.gC===j.gV).length;
  const der = timeSel ? jogos.filter(j=>j.vis===timeSel&&j.gV>j.gC).length : jogos.filter(j=>j.gC<j.gV).length;

  // Últimos 10 jogos (do campeonato, ou só desse time se filtrado) — jogos já vêm sem ordenação garantida, então ordenamos por data desc.
  // Over 1.5 / Over 2.5 / Ambas Marcam abaixo são calculados só nesses últimos 10, pra refletir o momento atual.
  const ordenados=[...jogos].sort((a,b)=>{ const da=a.data?new Date(a.data):new Date(0); const db=b.data?new Date(b.data):new Date(0); return db-da; });
  const ult10=ordenados.slice(0,10);
  const n10=ult10.length;
  const over15_10=ult10.filter(j=>(j.gC+j.gV)>1).length;
  const over25_10=ult10.filter(j=>(j.gC+j.gV)>2).length;
  const btts10=ult10.filter(j=>j.gC>0&&j.gV>0).length;

  // Top marcadores — soma os gols de quem jogou nesses confrontos (se um time estiver selecionado,
  // é so dos jogos desse time: ele mesmo + cada adversário que enfrentou)
  const golsTime={};
  jogos.forEach(j=>{
    golsTime[j.casa]=(golsTime[j.casa]||0)+(j.gC||0);
    golsTime[j.vis]=(golsTime[j.vis]||0)+(j.gV||0);
  });
  const topTimes=Object.entries(golsTime).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxGols=topTimes[0]?.[1]||1;

  document.getElementById('statsExtras').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">🏠 Mandante</div><div class="seb-val">${vit}</div><div class="seb-sub">${total?Math.round(vit/total*100):0}%</div></div>
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">🤝 Empate</div><div class="seb-val">${emp}</div><div class="seb-sub">${total?Math.round(emp/total*100):0}%</div></div>
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">✈️ Visitante</div><div class="seb-val">${der}</div><div class="seb-sub">${total?Math.round(der/total*100):0}%</div></div>
    </div>
    <div style="font-size:10px;color:var(--texto2);text-transform:uppercase;letter-spacing:.8px;margin:4px 0 6px">Nos últimos ${n10} jogos</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">Over 1.5</div><div class="seb-val">${over15_10}</div><div class="seb-sub">${n10?Math.round(over15_10/n10*100):0}%</div></div>
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">Over 2.5</div><div class="seb-val">${over25_10}</div><div class="seb-sub">${n10?Math.round(over25_10/n10*100):0}%</div></div>
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">Ambas Marcam</div><div class="seb-val">${btts10}</div><div class="seb-sub">${n10?Math.round(btts10/n10*100):0}%</div></div>
    </div>
    ${topTimes.length?`<div class="card" style="margin-bottom:14px">
      <div class="card-title">🥇 Top Marcadores</div>
      <div class="top-times">
        ${topTimes.map(([nome,g],i)=>`<div class="tt-row">
          <div class="tt-rank">${i+1}º</div>
          <div class="tt-nome">${nome}</div>
          <div class="tt-bar"><div class="tt-fill" style="width:${Math.round(g/maxGols*100)}%"></div></div>
          <div class="tt-val">${g} ⚽</div>
        </div>`).join('')}
      </div>
    </div>`:''}
  `;

  // Últimos resultados: só os 5 mais recentes. Cada linha abre o detalhe do jogo ao tocar.
  const rec = ordenados.slice(0, 5);
  document.getElementById('recentList').innerHTML = rec.length
    ? rec.map(j=>`<div class="match-row" style="cursor:pointer" onclick="abrirDetalheJogo(${j.id})"><div class="match-camp"><span class="mc-texto">${j.camp}${j.data?' · '+fd(j.data):''}${j.rodada?' · '+j.rodada:''}</span>${res(j.gC,j.gV)}</div><div class="match-teams">${escudoMini(j.casa)}<span class="nome nome-casa">${j.casa}</span><span class="placar">${j.gC} × ${j.gV}</span><span class="nome nome-vis">${j.vis}</span>${escudoMini(j.vis)}</div></div>`).join('')
    : `<div class="empty"><div class="icon">📋</div><p>Nenhum jogo ainda.</p></div>`;
}

function filtrarCamp(nome){
  window.campGeral = nome;
  window.timeGeral = '';
  renderGeral();
  window.scrollTo({top:0,behavior:'smooth'});
}

function filtrarTime(nome){
  window.timeGeral = nome;
  renderGeral();
}

function abrirDetalheJogo(id){
  const j = jogosCache.find(x=>x.id===id);
  if(!j) return;
  const gC2=(j.gols||[]).filter(g=>g.time==='casa').sort((a,b)=>a.min-b.min);
  const gV2=(j.gols||[]).filter(g=>g.time==='vis').sort((a,b)=>a.min-b.min);
  const linhaGol = (g)=>`<div style="font-size:12px;color:var(--texto2);padding:3px 0">⚽ ${g.min}' ${g.nome||''}</div>`;
  document.getElementById('detJogoTitulo').textContent = `${j.camp}${j.data?' · '+fd(j.data):''}${j.rodada?' · '+j.rodada:''}`;
  document.getElementById('detJogoPlacar').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:14px 0">
      <div style="flex:1;text-align:center">
        <div style="width:96px;height:96px;border-radius:50%;background:#fff;border:1px solid var(--c3);display:flex;align-items:center;justify-content:center;font-size:34px;margin:0 auto 8px;overflow:hidden;padding:8px;box-sizing:border-box">${escudoImgOuIcone(j.casa)}</div>
        <div style="font-weight:800;font-size:14px">${j.casa}</div>
      </div>
      <div style="font-size:26px;font-weight:900;color:var(--ouro)">${j.gC} × ${j.gV}</div>
      <div style="flex:1;text-align:center">
        <div style="width:96px;height:96px;border-radius:50%;background:#fff;border:1px solid var(--c3);display:flex;align-items:center;justify-content:center;font-size:34px;margin:0 auto 8px;overflow:hidden;padding:8px;box-sizing:border-box">${escudoImgOuIcone(j.vis)}</div>
        <div style="font-weight:800;font-size:14px">${j.vis}</div>
      </div>
    </div>`;
  document.getElementById('detJogoGols').innerHTML = (gC2.length||gV2.length) ? `
    <div style="display:flex;gap:16px">
      <div style="flex:1">${gC2.length?gC2.map(linhaGol).join(''):'<div style="font-size:12px;color:var(--texto2)">—</div>'}</div>
      <div style="flex:1">${gV2.length?gV2.map(linhaGol).join(''):'<div style="font-size:12px;color:var(--texto2)">—</div>'}</div>
    </div>` : '';
  document.getElementById('detJogoExtra').innerHTML = (j.escanteiosC!=null && j.escanteiosV!=null)
    ? `<div style="font-size:12px;color:var(--texto2);text-align:center;margin-top:8px">🚩 Escanteios: ${j.escanteiosC} × ${j.escanteiosV}</div>` : '';
  document.getElementById('modalDetalheJogo').classList.add('open');
}
function fecharDetalheJogo(){
  document.getElementById('modalDetalheJogo').classList.remove('open');
}

