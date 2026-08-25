// ═══════════════════════════════════════════════════
// ABA GERAL — dashboard, cards de campeonato, últimos resultados, modal de detalhe
// ═══════════════════════════════════════════════════
// ══ RENDER GERAL ══
function renderGeral(){
  const campSel = window.campGeral || '';
  const jogos = campSel ? jogosCache.filter(j=>j.camp===campSel) : [];

  // ── Grade de campeonatos: sempre atualizada, é o ponto de entrada da página ──
  // O nome do campeonato (`camp`) continua sendo a chave única usada em todo o app
  // (filtros, estatísticas, etc.) — o que mudou é que o país exibido no card agora
  // vem do dado real de cada jogo (`pais`), não mais adivinhado pelo nome. Por isso
  // é importante nunca reaproveitar o mesmo nome de campeonato pra países diferentes.
  const cMap={}; const paisPorCamp={};
  jogosCache.forEach(j=>{
    cMap[j.camp]=(cMap[j.camp]||0)+1;
    if(j.pais && !paisPorCamp[j.camp]) paisPorCamp[j.camp]=j.pais;
  });
  const ordemCamps = comEspeciaisPorUltimo(gruposCampeonato(Object.keys(cMap)).flatMap(g=>g.itens));
  const ent = ordemCamps.map(n=>[n,cMap[n]]);

  // Jogos de hoje e jogos agendados pra depois (lista da Aba Oportunidades) —
  // usados no Resumo e no selo de cada liga. Itens sem `data` (salvos antes desse
  // campo existir) contam como "hoje", pra não sumir nada de quem já usava a lista.
  const hoje = window.hojeBR ? window.hojeBR() : null;
  const listaAtiva = (window.ophLoad ? window.ophLoad() : []).filter(j=> window.ophExpirado ? !window.ophExpirado(j) : true);
  const hojeLista = listaAtiva.filter(j=>!j.data || j.data===hoje);
  const futurosLista = listaAtiva.filter(j=>j.data && hoje && j.data>hoje);
  const hojePorCamp = {};
  hojeLista.forEach(j=>{ if(j.camp) hojePorCamp[j.camp] = (hojePorCamp[j.camp]||0)+1; });
  // Próximo jogo agendado por campeonato (a data mais próxima no futuro), pra mostrar
  // no card quando não tiver jogo hoje — em vez de só cravar "0 jogos hoje".
  const proximoPorCamp = {};
  futurosLista.forEach(j=>{
    if(!j.camp) return;
    if(!proximoPorCamp[j.camp] || j.data<proximoPorCamp[j.camp]) proximoPorCamp[j.camp]=j.data;
  });

  // Resumo: Campeonatos / Partidas na Temporada (só das ligas com jogo hoje, se houver) / Jogos de hoje
  const ligasComJogoHoje = new Set(hojeLista.map(j=>j.camp).filter(Boolean));
  const partidasTemporada = ligasComJogoHoje.size
    ? jogosCache.filter(j=>ligasComJogoHoje.has(j.camp)).length
    : jogosCache.length; // sem nenhum jogo de hoje cadastrado ainda: mostra o total geral
  const elResCamps = document.getElementById('resumoCampeonatos');
  const elResPartidas = document.getElementById('resumoPartidasTemporada');
  const elResHoje = document.getElementById('resumoJogosHoje');
  if(elResCamps) elResCamps.textContent = ent.length;
  if(elResPartidas) elResPartidas.textContent = partidasTemporada;
  if(elResHoje) elResHoje.textContent = hojeLista.length;

  document.getElementById('campList').innerHTML = ent.length
    ? `<div class="camp-list">${ent.map(([n,c])=>{
        const qtdHoje = hojePorCamp[n]||0;
        const pais = paisPorCamp[n] || paisDoCampeonato(n);
        // Selo dinâmico: jogo(s) hoje (verde) > próximo jogo agendado (neutro) > nada (sem selo)
        let selo = '';
        if(qtdHoje){
          selo = `<div class="camp-badge tem-jogo">${qtdHoje} jogo${qtdHoje===1?'':'s'} hoje</div>`;
        } else if(proximoPorCamp[n]){
          selo = `<div class="camp-badge">Próximo: ${fd(proximoPorCamp[n])}</div>`;
        }
        return `<div class="camp-row" onclick="filtrarCamp('${n}')">
          ${pais?`<div class="camp-pais">${pais}</div>`:''}
          <div class="camp-nome">${n}</div>
          <div class="camp-num">${c}</div>
          <div class="camp-cap">partidas disputadas</div>
          ${selo}
        </div>`;
      }).join('')}</div>`
    : `<div class="empty"><div class="icon"><span data-ic="trophy" data-ic-size="38"></span></div><p>Sem campeonatos ainda.</p></div>`;
  window.renderIcons?.(document.getElementById('campList'));

  if(!campSel){
    document.getElementById('cardCamps').style.display='';
    document.getElementById('geralCampSelecionado').style.display='none';
    return;
  }

  // ── Campeonato selecionado: esconde a grade, mostra as estatísticas dele (sem filtro de time) ──
  document.getElementById('cardCamps').style.display='none';
  document.getElementById('ophListaCardDash').style.display='none';
  document.getElementById('geralCampSelecionado').style.display='block';
  document.getElementById('geralCampNome').innerHTML = '<span data-ic="trophy" data-ic-size="15"></span> '+campSel;
  window.renderIcons?.(document.getElementById('geralCampNome'));

  const total=jogos.length;
  const gols=jogos.reduce((s,j)=>s+(j.gC||0)+(j.gV||0),0);
  const bttsTotal=jogos.filter(j=>j.gC>0&&j.gV>0).length;
  document.getElementById('sTotal').textContent=total;
  document.getElementById('sGols').textContent=gols;
  document.getElementById('sBtts').textContent=bttsTotal;
  document.getElementById('sMedia').textContent=total?(gols/total).toFixed(1):'0.0';

  const vit = jogos.filter(j=>j.gC>j.gV).length;
  const emp = jogos.filter(j=>j.gC===j.gV).length;
  const der = jogos.filter(j=>j.gC<j.gV).length;

  // Jogos ordenados do mais recente pro mais antigo — usados só nos "Últimos Resultados" abaixo.
  const ordenados=[...jogos].sort((a,b)=>{ const da=a.data?new Date(a.data):new Date(0); const db=b.data?new Date(b.data):new Date(0); return db-da; });

  // Top marcadores — soma os gols de quem jogou nesse campeonato
  const golsTime={};
  jogos.forEach(j=>{
    golsTime[j.casa]=(golsTime[j.casa]||0)+(j.gC||0);
    golsTime[j.vis]=(golsTime[j.vis]||0)+(j.gV||0);
  });
  const topTimes=Object.entries(golsTime).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxGols=topTimes[0]?.[1]||1;

  document.getElementById('statsExtras').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">Mandante</div><div class="seb-val">${vit}</div><div class="seb-sub">${total?Math.round(vit/total*100):0}%</div></div>
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">Empate</div><div class="seb-val">${emp}</div><div class="seb-sub">${total?Math.round(emp/total*100):0}%</div></div>
      <div class="stat-extra-box" style="text-align:center"><div class="seb-label">Visitante</div><div class="seb-val">${der}</div><div class="seb-sub">${total?Math.round(der/total*100):0}%</div></div>
    </div>
    ${topTimes.length?`<div class="card" style="margin-bottom:14px">
      <div class="card-title">Top Marcadores</div>
      <div class="top-times">
        ${topTimes.map(([nome,g],i)=>`<div class="tt-row">
          <div class="tt-rank">${i+1}º</div>
          <div class="tt-nome">${nome}</div>
          <div class="tt-bar"><div class="tt-fill" style="width:${Math.round(g/maxGols*100)}%"></div></div>
          <div class="tt-val">${g} <span data-ic="target" data-ic-size="11"></span></div>
        </div>`).join('')}
      </div>
    </div>`:''}
  `;
  window.renderIcons?.(document.getElementById('statsExtras'));

  // Últimos resultados: só os 5 mais recentes. Cada linha abre o detalhe do jogo ao tocar.
  const rec = ordenados.slice(0, 5);
  document.getElementById('recentList').innerHTML = rec.length
    ? rec.map(j=>`<div class="match-row" style="cursor:pointer" onclick="abrirDetalheJogo(${j.id})"><div class="match-camp"><span class="mc-texto">${j.camp}${j.data?' · '+fd(j.data):''}${j.rodada?' · '+j.rodada:''}</span>${res(j.gC,j.gV)}</div><div class="match-teams">${escudoMini(j.casa)}<span class="nome nome-casa">${j.casa}</span><span class="placar">${j.gC} × ${j.gV}</span><span class="nome nome-vis">${j.vis}</span>${escudoMini(j.vis)}</div></div>`).join('')
    : `<div class="empty"><div class="icon"><span data-ic="clipboard" data-ic-size="38"></span></div><p>Nenhum jogo ainda.</p></div>`;
  window.renderIcons?.(document.getElementById('recentList'));
}

function filtrarCamp(nome){
  window.campGeral = nome;
  renderGeral();
  window.scrollTo({top:0,behavior:'smooth'});
}

function abrirDetalheJogo(id){
  toastEsconder();
  const j = jogosCache.find(x=>x.id===id);
  if(!j) return;
  const gC2=(j.gols||[]).filter(g=>g.time==='casa').sort((a,b)=>a.min-b.min);
  const gV2=(j.gols||[]).filter(g=>g.time==='vis').sort((a,b)=>a.min-b.min);
  const linhaGol = (g)=>`<div style="font-size:12px;color:var(--texto2);padding:3px 0;display:flex;align-items:center;gap:4px"><span data-ic="target" data-ic-size="11"></span> ${g.min}${g.acr?`+${g.acr}`:''}' ${g.nome||''}</div>`;
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
  window.renderIcons?.(document.getElementById('detJogoGols'));
  document.getElementById('detJogoExtra').innerHTML = (j.escanteiosC!=null && j.escanteiosV!=null)
    ? `<div style="font-size:12px;color:var(--texto2);text-align:center;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:4px"><span data-ic="flag" data-ic-size="11"></span> Escanteios: ${j.escanteiosC} × ${j.escanteiosV}</div>` : '';
  window.renderIcons?.(document.getElementById('detJogoExtra'));
  document.getElementById('modalDetalheJogo').classList.add('open');
}
function fecharDetalheJogo(){
  document.getElementById('modalDetalheJogo').classList.remove('open');
}

