// ═══════════════════════════════════════════════════
// ABA CALCULADORA — cálculo de entrada, lançar entrada (simples/dupla/múltipla/outros)
// (cadastro de participantes/depósitos/retiradas foi removido — a Banca agora é uma
// carteira individual só, gerenciada em 14-banca-gestao.js / src/components/Banca.jsx)
// ═══════════════════════════════════════════════════
// ══ ENTRADA ══
function buscarMercadoAnalise(){
  if(!ultimaAnalise){ toast('⚠️ Faça uma análise primeiro na aba 📊 Análise'); return; }
  const wrap = document.getElementById('mercadoSugestoesWrap');
  const sel  = document.getElementById('mercadoSugestoes');
  document.getElementById('mercadoSugestoesLabel').textContent = `📊 Mercados da análise: ${ultimaAnalise.casa} × ${ultimaAnalise.vis}`;
  sel.innerHTML = '<option value="">— Selecione um mercado —</option>' +
    ultimaAnalise.mercados.map(m=>`<option value="${m.nome}">${m.nome} — ${m.prob}%</option>`).join('');
  wrap.style.display='block';
}

function selecionarMercado(nome){
  if(!nome || !ultimaAnalise) return;
  document.getElementById('eMercado').value = nome;
  document.getElementById('eTimes').value = ultimaAnalise.casa+' × '+ultimaAnalise.vis;
  if(ultimaAnalise.liga){
    const eLigaEl = document.getElementById('eLiga');
    if(eLigaEl && !eLigaEl.value) eLigaEl.value = ultimaAnalise.liga;
  }
  atualizarResumoEntrada();
  toast('✅ '+nome+' preenchido!');
}

// ══ Resumo da operação — atualiza sozinho conforme os campos vão sendo preenchidos ══
function atualizarResumoEntrada(){
  const el = document.getElementById('resumoEntrada');
  if(!el) return;
  const liga    = document.getElementById('eLiga').value.trim();
  const times   = document.getElementById('eTimes').value.trim();
  const mercado = document.getElementById('eMercado').value.trim();
  const tipo    = document.getElementById('eTipo').value || 'prelive';
  const minuto  = document.getElementById('eMinuto').value;

  if(!liga && !times && !mercado){
    el.innerHTML = 'Preencha os campos abaixo para montar o resumo da operação.';
    return;
  }
  const linhas = [
    liga    ? `🏆 ${liga}` : null,
    times   ? `⚽ ${times}` : null,
    mercado ? `📈 ${mercado}` : null,
    tipo==='live' ? `🔴 Ao vivo${minuto?' • '+minuto+"'":''}` : `🔵 Pré-live`,
  ].filter(Boolean);
  el.innerHTML = linhas.map(l=>`<div>${l}</div>`).join('');
}

function setPct(pct, ev){
  document.getElementById('ePct').value=pct;
  document.querySelectorAll('.btn-pct').forEach(b=>b.classList.remove('ativo'));
  (ev || window.event)?.target.classList.add('ativo');
  calcEntrada();
}

function calcEntrada(){
  const d = bpLoad();
  const tot = d.saldo||0;
  const pct = parseFloat(document.getElementById('ePct').value);
  const odd = parseFloat(document.getElementById('eOdd').value);
  const el  = document.getElementById('entradaPreview');
  if(!el) return;
  if(!tot){ el.innerHTML='<span style="color:var(--perigo)">⚠️ Saldo da carteira zerado — faça um depósito na aba Banca</span>'; return; }
  if(!pct){ el.innerHTML='Selecione % da banca'; return; }
  const stake = Math.round(tot*pct/100*100)/100;
  const lucro = odd ? Math.round(stake*(odd-1)*100)/100 : null;
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:9px">
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--texto2)">Banca</span><strong style="color:var(--ouro)">R$ ${tot.toFixed(2)}</strong></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--texto2)">Stake (${pct}%)</span><strong>R$ ${stake.toFixed(2)}</strong></div>
    ${lucro!=null?`<div style="display:flex;justify-content:space-between;align-items:center;padding-top:9px;border-top:1px solid var(--c3)"><span style="color:var(--texto2)">Lucro Pot.</span><strong style="color:#4dd87a">R$ ${lucro.toFixed(2)}</strong></div>`:''}
  </div>`;
}

function setTipoEntrada(tipo){
  document.getElementById('eTipo').value = tipo;
  const pre  = document.getElementById('btnTipoPre');
  const live = document.getElementById('btnTipoLive');
  if(tipo==='prelive'){
    pre.style.borderColor='var(--verde2)'; pre.style.background='rgba(37,163,82,.15)'; pre.style.color='var(--verde2)';
    live.style.borderColor='var(--c3)';    live.style.background='var(--c1)';           live.style.color='var(--texto2)';
  } else {
    live.style.borderColor='var(--perigo)'; live.style.background='rgba(224,92,58,.15)'; live.style.color='var(--perigo)';
    pre.style.borderColor='var(--c3)';      pre.style.background='var(--c1)';             pre.style.color='var(--texto2)';
  }
  document.getElementById('campoMinutoEntrada').style.display = tipo==='live' ? 'block' : 'none';
  atualizarResumoEntrada();
}

// ══ SIMPLES / DUPLA / MÚLTIPLA ══
let tipoAposta = 'simples';
let pernas = [];

function setTipoAposta(tipo){
  tipoAposta = tipo;
  const botoes = { simples:'btnApostaSimples', dupla:'btnApostaDupla', multipla:'btnApostaMultipla', outros:'btnApostaOutros' };
  Object.entries(botoes).forEach(([t,id])=>{
    const b = document.getElementById(id);
    if(t===tipo){ b.style.borderColor='var(--verde2)'; b.style.background='rgba(37,163,82,.15)'; b.style.color='var(--verde2)'; }
    else        { b.style.borderColor='var(--c3)';     b.style.background='var(--c1)';           b.style.color='var(--texto2)'; }
  });

  document.getElementById('blocoMercadoSimples').style.display = tipo==='simples' ? 'block' : 'none';
  document.getElementById('blocoPernas').style.display         = tipo==='simples' ? 'none'  : 'block';
  document.getElementById('btnAddPerna').style.display          = (tipo==='multipla'||tipo==='outros') ? 'block' : 'none';

  const eOddEl = document.getElementById('eOdd');
  eOddEl.readOnly = tipo!=='simples';
  eOddEl.style.opacity = tipo!=='simples' ? '.7' : '1';

  if(tipo==='simples'){
    document.getElementById('eMercado').value = '';
    document.getElementById('eTimes').value = '';
    eOddEl.value = '';
    calcEntrada();
    atualizarResumoEntrada();
    return;
  }

  // Ao entrar em Dupla/Múltipla, reseta o "mesmo jogo?" — evita herdar um confronto de outro mercado
  document.getElementById('mesmoJogoCheck').checked = false;
  document.getElementById('eTimesCombo').value = '';
  document.getElementById('eTimes').value = '';
  document.getElementById('blocoConfrontoCombo').style.display = 'none';
  atualizarResumoEntrada();

  if(pernas.length<2) pernas = [{id:Date.now(), mercado:'', odd:''}, {id:Date.now()+1, mercado:'', odd:''}];
  if(tipo==='dupla' && pernas.length>2) pernas = pernas.slice(0,2);
  renderPernas();
  atualizarCombinada();
}

function toggleMesmoJogo(){
  const marcado = document.getElementById('mesmoJogoCheck').checked;
  document.getElementById('blocoConfrontoCombo').style.display = marcado ? 'block' : 'none';
  if(!marcado){
    document.getElementById('eTimesCombo').value = '';
    document.getElementById('eTimes').value = '';
  }
  atualizarResumoEntrada();
}

function adicionarPerna(){
  if(tipoAposta!=='multipla' && tipoAposta!=='outros') return;
  pernas.push({ id:Date.now(), mercado:'', odd:'' });
  renderPernas();
  atualizarCombinada();
}
function removerPerna(id){
  if(pernas.length<=2){ toast('⚠️ Mínimo 2 mercados numa combinada'); return; }
  pernas = pernas.filter(p=>p.id!==id);
  renderPernas();
  atualizarCombinada();
}
function atualizarPerna(id, campo, valor){
  const p = pernas.find(x=>x.id===id);
  if(p){ p[campo]=valor; atualizarCombinada(); }
}
function renderPernas(){
  const wrap = document.getElementById('pernasLista');
  if(!wrap) return;
  wrap.innerHTML = pernas.map((p,i)=>`<div style="display:flex;gap:8px;align-items:center">
    <input type="text" placeholder="Mercado ${i+1} (ex: Over 1.5)" value="${p.mercado}" list="mercadoDatalist" oninput="atualizarPerna(${p.id},'mercado',this.value)" style="flex:2">
    <input type="number" min="1.01" step="0.01" placeholder="Odd" value="${p.odd}" oninput="atualizarPerna(${p.id},'odd',this.value)" style="flex:1;min-width:0">
    ${(tipoAposta==='multipla'||tipoAposta==='outros') ? `<button type="button" onclick="removerPerna(${p.id})" style="background:none;border:1px solid var(--perigo);border-radius:6px;padding:8px 10px;color:var(--perigo);cursor:pointer;flex-shrink:0">✕</button>` : ''}
  </div>`).join('');
}
function atualizarCombinada(){
  const validas = pernas.filter(p=>p.mercado.trim() && parseFloat(p.odd)>0);
  const todasValidas = validas.length===pernas.length && pernas.length>=2;
  const oddCombinada = pernas.reduce((acc,p)=>acc*(parseFloat(p.odd)||1), 1);
  document.getElementById('oddCombinadaDisplay').textContent = todasValidas ? oddCombinada.toFixed(2) : '—';
  document.getElementById('eMercado').value = pernas.map(p=>p.mercado.trim()).filter(Boolean).join(' + ');
  document.getElementById('eOdd').value = todasValidas ? oddCombinada.toFixed(2) : '';
  calcEntrada();
  atualizarResumoEntrada();
}


async function lancarEntrada(){
  const mercado = document.getElementById('eMercado').value.trim();
  const liga    = document.getElementById('eLiga').value.trim();
  const times   = document.getElementById('eTimes').value.trim();
  const tipo    = document.getElementById('eTipo').value || 'prelive';
  const desc    = mercado + (times?' · '+times:'') + (liga?' · '+liga:'');
  const pct  = parseFloat(document.getElementById('ePct').value);
  const odd  = parseFloat(document.getElementById('eOdd').value);
  const res  = document.getElementById('eResultado').value;
  if(!mercado){ toast('⚠️ Informe o mercado'); return; }
  if(!pct)  { toast('⚠️ Informe a % da banca'); return; }
  if(!odd)  { toast('⚠️ Informe a odd'); return; }
  if(!res)  { toast('⚠️ Selecione o resultado'); return; }

  // Confirmação final — modal customizado (evita bug de path no Android)
  const rotuloTipo = tipo==='live' ? `LIVE — minuto ${document.getElementById('eMinuto').value||'?'}'` : 'PRÉ-LIVE';
  const rotuloAposta = { simples:'Simples', dupla:'Dupla (2 mercados)', multipla:`Múltipla (${pernas.length} mercados)`, outros:`Outros (${pernas.length} mercados)` }[tipoAposta];
  const linhas = [
    `<strong>Aposta:</strong> ${rotuloAposta}`,
    `<strong>Mercado:</strong> ${mercado}${times?' ('+times+')':''}`,
    `<strong>Tipo:</strong> ${rotuloTipo}`,
    `<strong>Odd:</strong> ${odd}`,
    `<strong>Resultado:</strong> ${res.toUpperCase()}`
  ];
  document.getElementById('modalConfirmarTexto').innerHTML = linhas.join('<br>');
  document.getElementById('modalConfirmarEntrada').classList.add('open');

  // Aguarda decisão do usuário via promessa
  const confirmado = await new Promise(resolve => {
    document.getElementById('modalConfirmarOk').onclick = () => {
      document.getElementById('modalConfirmarEntrada').classList.remove('open');
      resolve(true);
    };
    document.getElementById('modalConfirmarCancelar').onclick = () => {
      document.getElementById('modalConfirmarEntrada').classList.remove('open');
      resolve(false);
    };
  });
  if(!confirmado) return;

  const d = bpLoad();
  const tot = d.saldo||0;
  if(tot<=0){ toast('⚠️ Saldo da carteira zerado — faça um depósito na aba Banca'); return; }
  const stake   = Math.round(tot*pct/100*100)/100;
  const lucroB  = res==='green' ? Math.round(stake*(odd-1)*100)/100 : 0;
  const protecaoAtiva = d.protecaoAtiva!==false;
  const protecaoPct   = d.protecaoPct??10;
  // Green: parte do lucro vai automaticamente pra Reserva (proteção da banca), o resto fica na Carteira.
  // Red: o stake sai direto da Carteira. Void: não mexe em nada.
  const reservaCorte  = res==='green' ? Math.round(lucroB*(protecaoAtiva?protecaoPct:0)/100*100)/100 : 0;
  const ganhoCarteira = res==='green' ? Math.round((lucroB-reservaCorte)*100)/100 : 0;
  const percaCarteira = res==='red'   ? stake : 0;

  d.reserva = Math.round(((d.reserva||0)+reservaCorte)*100)/100;
  d.saldo   = Math.round(((d.saldo||0)+ganhoCarteira-percaCarteira)*100)/100;
  d.entradas.unshift({
    id:Date.now(), desc, pct, odd, stake, resultado:res,
    lucro:lucroB, reservaCorte, ganhoCarteira,
    liga, mercado, times, tipo, tipoAposta,
    minuto: tipo==='live' ? (parseInt(document.getElementById('eMinuto').value)||null) : null,
    data: document.getElementById('eDataEntrada').value || new Date().toISOString().split('T')[0]
  });
  bpSave(d);

  ['ePct','eOdd','eLiga','eMercado','eMinuto','eTimes','eTimesCombo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const mjEl=document.getElementById('mesmoJogoCheck'); if(mjEl) mjEl.checked=false;
  const erEl=document.getElementById('eResultado'); if(erEl) erEl.value='cancelado';
  setTipoEntrada('prelive');
  pernas = [];
  setTipoAposta('simples');
  const eDataEl=document.getElementById('eDataEntrada'); if(eDataEl) eDataEl.value=new Date().toISOString().split('T')[0];
  const epEl=document.getElementById('entradaPreview'); if(epEl) epEl.innerHTML='Selecione % da banca para ver o valor';
  document.querySelectorAll('.btn-pct').forEach(b=>b.classList.remove('ativo'));
  atualizarResumoEntrada();

  window.resolvidasRefresh?.();
  window.bancaRefresh?.();
  toast(res==='green'?'✅ Green!':res==='red'?'❌ Red!':res==='void'?'↩️ Void!':'⬜ Registrado como cancelado');
}

function excluirEntrada(id){
  document.getElementById('modalConfirmarExclusao').classList.add('open');
  document.getElementById('modalExclusaoOk').onclick = () => {
    document.getElementById('modalConfirmarExclusao').classList.remove('open');
    const d = bpLoad();
    const e = d.entradas.find(x=>x.id===id);
    if(e){
      if(e.resultado==='green'){
        d.reserva = Math.round(((d.reserva||0)-(e.reservaCorte||0))*100)/100;
        d.saldo   = Math.round(((d.saldo||0)-(e.ganhoCarteira||0))*100)/100;
      } else if(e.resultado==='red'){
        d.saldo   = Math.round(((d.saldo||0)+(e.stake||0))*100)/100;
      }
      d.entradas = d.entradas.filter(x=>x.id!==id);
    }
    bpSave(d);
    window.resolvidasRefresh?.();
    window.bancaRefresh?.();
    toast('🗑️ Entrada removida');
  };
  document.getElementById('modalExclusaoCancelar').onclick = () => {
    document.getElementById('modalConfirmarExclusao').classList.remove('open');
  };
}

// ══ EDITAR ENTRADA (corrige mercado, odd, resultado, data etc. de um lançamento já feito) ══
let idEntradaEmEdicao = null;
function editarEntrada(id){
  const d = bpLoad();
  const e = d.entradas.find(x=>x.id===id);
  if(!e) return;
  idEntradaEmEdicao = id;
  document.getElementById('editEMercado').value   = e.mercado || '';
  document.getElementById('editETipoAposta').value = e.tipoAposta || 'simples';
  document.getElementById('editELiga').value      = e.liga || '';
  document.getElementById('editETimes').value     = e.times || '';
  document.getElementById('editETipo').value      = e.tipo || 'prelive';
  document.getElementById('editEMinuto').value    = e.minuto || '';
  document.getElementById('editEMinutoWrap').style.display = (e.tipo==='live') ? 'block' : 'none';
  document.getElementById('editEOdd').value       = e.odd || '';
  document.getElementById('editEStake').value     = e.stake || '';
  document.getElementById('editEResultado').value = e.resultado || 'green';
  document.getElementById('editEData').value      = e.data || '';
  document.getElementById('modalEditarEntrada').classList.add('open');
}
function fecharModalEditarEntrada(){
  document.getElementById('modalEditarEntrada').classList.remove('open');
  idEntradaEmEdicao = null;
}
function salvarEdicaoEntrada(){
  const id = idEntradaEmEdicao;
  if(id==null) return;
  const d = bpLoad();
  const idx = d.entradas.findIndex(x=>x.id===id);
  if(idx<0){ fecharModalEditarEntrada(); return; }
  const antiga = d.entradas[idx];

  const novoMercado = document.getElementById('editEMercado').value.trim();
  const novoTipoAposta = document.getElementById('editETipoAposta').value;
  const novoLiga     = document.getElementById('editELiga').value.trim();
  const novoTimes    = document.getElementById('editETimes').value.trim();
  const novoTipo     = document.getElementById('editETipo').value;
  const novoMinuto   = novoTipo==='live' ? (parseInt(document.getElementById('editEMinuto').value)||null) : null;
  const novoOdd      = parseFloat(document.getElementById('editEOdd').value);
  const novoStakeInformado = parseFloat(document.getElementById('editEStake').value);
  const novoRes      = document.getElementById('editEResultado').value;
  const novaData     = document.getElementById('editEData').value || antiga.data;

  if(!novoMercado){ toast('⚠️ Informe o mercado'); return; }
  if(!novoOdd)     { toast('⚠️ Informe a odd'); return; }
  if(!novoStakeInformado || novoStakeInformado<=0) { toast('⚠️ Informe o valor apostado'); return; }

  // Reverte o efeito antigo na carteira/reserva e remove a entrada, pra recalcular do zero
  if(antiga.resultado==='green'){
    d.reserva = Math.round(((d.reserva||0)-(antiga.reservaCorte||0))*100)/100;
    d.saldo   = Math.round(((d.saldo||0)-(antiga.ganhoCarteira||0))*100)/100;
  } else if(antiga.resultado==='red'){
    d.saldo   = Math.round(((d.saldo||0)+(antiga.stake||0))*100)/100;
  }
  d.entradas.splice(idx,1);

  const tot   = d.saldo||0;
  const stake = Math.round(novoStakeInformado*100)/100;
  const pct   = tot>0 ? Math.round((stake/tot)*1000)/10 : antiga.pct;
  const lucroB = novoRes==='green' ? Math.round(stake*(novoOdd-1)*100)/100 : 0;
  const protecaoAtiva = d.protecaoAtiva!==false;
  const protecaoPct   = d.protecaoPct??10;
  const reservaCorte  = novoRes==='green' ? Math.round(lucroB*(protecaoAtiva?protecaoPct:0)/100*100)/100 : 0;
  const ganhoCarteira = novoRes==='green' ? Math.round((lucroB-reservaCorte)*100)/100 : 0;
  const percaCarteira = novoRes==='red'   ? stake : 0;

  d.reserva = Math.round(((d.reserva||0)+reservaCorte)*100)/100;
  d.saldo   = Math.round(((d.saldo||0)+ganhoCarteira-percaCarteira)*100)/100;

  const desc = novoMercado + (novoTimes?' · '+novoTimes:'') + (novoLiga?' · '+novoLiga:'');
  d.entradas.splice(idx, 0, {
    ...antiga,
    desc, mercado:novoMercado, tipoAposta:novoTipoAposta, liga:novoLiga, times:novoTimes, tipo:novoTipo, minuto:novoMinuto,
    odd:novoOdd, resultado:novoRes, stake, pct, lucro:lucroB, reservaCorte, ganhoCarteira,
    data:novaData
  });

  bpSave(d);
  fecharModalEditarEntrada();
  window.resolvidasRefresh?.();
  window.bancaRefresh?.();
  toast('✅ Entrada atualizada');
}

// ══ RENDER HISTÓRICO ══
// ══ MINUTO MÉDIO DO GOL QUE BATE O OVER (histórico de jogos) ══
// Pra um Over X.5, o "gol que bate a linha" é o gol de número (X+1) no jogo (ex: Over 1.5 -> 2º gol, Over 2.5 -> 3º gol).
// A categoria 1ºT/2ºT é definida pelo minuto do 1º GOL do jogo (seu sinal de entrada ao vivo) — não pelo gol que bate o Over.
function calcularTempoGolLiga(camp, linha){
  const jogos = camp ? jogosCache.filter(j=>j.camp===camp) : jogosCache;
  // Base de comparação: jogos da liga que têm gols por minuto cadastrados (não conta jogos sem esse dado)
  const totalComDados = jogos.filter(j=>(j.gols||[]).some(g=>g.min!=null)).length;
  const idxGolNecessario = Math.floor(linha+0.5); // 1.5->2, 2.5->3, 3.5->4, 4.5->5
  const reg1T = []; // {primeiro, bateu}
  const reg2T = [];
  jogos.forEach(j=>{
    const total = (j.gC||0)+(j.gV||0);
    if(total<=linha) return; // não bateu essa linha
    const golsOrdenados = (j.gols||[]).map(g=>g.min).filter(m=>m!=null).sort((a,b)=>a-b);
    if(golsOrdenados.length<idxGolNecessario) return; // sem dados de minuto suficientes
    const primeiro = golsOrdenados[0];
    const bateu = golsOrdenados[idxGolNecessario-1];
    (primeiro<=45 ? reg1T : reg2T).push({primeiro, bateu});
  });
  function resumo(reg){
    if(!reg.length) return null;
    return {
      qtd: reg.length,
      pct: totalComDados ? Math.round((reg.length/totalComDados)*100) : null,
      mediaPrimeiro: Math.round(reg.reduce((a,r)=>a+r.primeiro,0)/reg.length),
      mediaBateu:    Math.round(reg.reduce((a,r)=>a+r.bateu,0)/reg.length),
    };
  }
  return { t1: resumo(reg1T), t2: resumo(reg2T), totalComDados };
}

function renderTempoGol(){
  const sel = document.getElementById('filtroLigaGlobal');
  const camp = sel ? sel.value : '';
  const tbody = document.getElementById('tempoGolBody');
  if(!tbody) return;

  const ligas = camp ? [camp] : sortNatural([...new Set(jogosCache.map(j=>j.camp))]);
  const linhas = [1.5, 2.5, 3.5, 4.5];
  let linhasHtml = '';
  ligas.forEach(liga=>{
    linhas.forEach(linha=>{
      const r = calcularTempoGolLiga(liga, linha);
      [['1ºT (1º gol até o 45\')', r.t1], ['2ºT (1º gol depois do 45\')', r.t2]].forEach(([rotuloTempo, res])=>{
        if(!res) return; // sem jogos nessa categoria, não poluir a tabela
        linhasHtml += `<tr>
          <td style="color:var(--verde2);font-weight:600">${liga}</td>
          <td>Over ${linha}</td>
          <td>${rotuloTempo}</td>
          <td class="td-c">${res.mediaPrimeiro}'</td>
          <td class="td-c">${res.mediaBateu}'</td>
          <td class="td-c">${res.qtd}</td>
          <td class="td-c" style="color:${res.pct>=50?'#4dd87a':res.pct>=25?'var(--ouro)':'#f08060'};font-weight:700">${res.pct!=null?res.pct+'%':'—'}</td>
        </tr>`;
      });
    });
  });

  tbody.innerHTML = linhasHtml || `<tr><td colspan="7"><div class="empty"><div class="icon">📐</div><p>Nenhum jogo com gols por minuto cadastrados bateu esses Overs ainda.</p></div></td></tr>`;
}

// ══ ESTATÍSTICA POR LIGA (agrupa entradas da Calculadora) ══
function renderLigas(){
  const tbody = document.getElementById('ligasBody');
  if(!tbody) return;
  const filtroTipo = document.getElementById('filtroLigaTipo')?.value || '';
  const filtroCamp = document.getElementById('filtroLigaGlobal')?.value || '';
  const d = bpLoad();
  let entradas = (d.entradas||[]).filter(e=>e.liga && e.mercado && (e.tipoAposta||'simples')==='simples');
  if(filtroTipo) entradas = entradas.filter(e=>(e.tipo||'prelive')===filtroTipo);
  if(filtroCamp) entradas = entradas.filter(e=>e.liga===filtroCamp);

  if(!entradas.length){
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="icon">📈</div><p>Nenhuma entrada com Liga e Mercado preenchidos ainda. Lance entradas na Calculadora informando esses campos.</p></div></td></tr>`;
    return;
  }

  // Agrupa por Liga + Tipo (prelive/live) + Mercado
  // Só entram aqui entradas Simples — Dupla/Múltipla/Outros não alimentam essa tabela
  // (mercados combinados costumam ter poucas entradas repetidas, não rendem estatística útil aqui)
  const grupos = {};
  entradas.forEach(e=>{
    const tipo = e.tipo || 'prelive';
    const key = `${e.liga}|||${tipo}|||${e.mercado}`;
    (grupos[key] = grupos[key] || []).push(e);
  });

  const linhas = Object.entries(grupos).map(([key, lista])=>{
    const [liga, tipo, mercado] = key.split('|||');
    const minutos = lista.filter(e=>e.minuto!=null).map(e=>e.minuto);
    const minMedio = minutos.length ? Math.round(minutos.reduce((a,b)=>a+b,0)/minutos.length) : null;
    const oddMedia = r2(lista.reduce((a,e)=>a+e.odd,0)/lista.length);
    const greens = lista.filter(e=>e.resultado==='green').length;
    const reds   = lista.filter(e=>e.resultado==='red').length;
    const validas = greens+reds;
    const pctAcerto = validas ? Math.round((greens/validas)*100) : null;
    return { liga, tipo, mercado, minMedio, oddMedia, qtd:lista.length, pctAcerto, greens, reds };
  });

  // Ordena por liga (natural) > tipo > mercado
  linhas.sort((a,b)=> a.liga.localeCompare(b.liga,'pt-BR',{numeric:true}) || a.tipo.localeCompare(b.tipo) || a.mercado.localeCompare(b.mercado));

  tbody.innerHTML = linhas.map(l=>{
    const cor = l.pctAcerto==null ? 'var(--texto2)' : l.pctAcerto>=70 ? '#4dd87a' : l.pctAcerto>=50 ? 'var(--ouro)' : '#f08060';
    return `<tr>
      <td style="color:var(--verde2);font-weight:600">${l.liga}</td>
      <td>${l.tipo==='live'?'🔴 Live':'📋 Pré-live'}</td>
      <td>${l.mercado}</td>
      <td class="td-c">${l.minMedio!=null?l.minMedio+"'":'—'}</td>
      <td class="td-c">${l.oddMedia}</td>
      <td class="td-c">${l.qtd}</td>
      <td class="td-c" style="color:${cor};font-weight:700">${l.pctAcerto!=null?l.pctAcerto+'%':'—'} <span style="color:var(--texto2);font-weight:400;font-size:10px">(${l.greens}G/${l.reds}R)</span></td>
    </tr>`;
  }).join('');
}

// ══ Versões PURAS (sem DOM) das duas tabelas acima — usadas pelo componente
// React da aba Estatística: src/components/Estatistica.jsx. As funções renderTempoGol()/
// renderLigas() de cima continuam existindo mas não são mais chamadas de lugar nenhum
// (os ids que elas escreviam não existem mais no HTML) — deixadas aí só de histórico.
function computeTempoGolTabela(camp){
  const ligas = camp ? [camp] : sortNatural([...new Set(jogosCache.map(j=>j.camp))]);
  const linhasDef = [1.5, 2.5, 3.5, 4.5];
  const linhas = [];
  ligas.forEach(liga=>{
    linhasDef.forEach(linha=>{
      const r = calcularTempoGolLiga(liga, linha);
      [['1ºT (1º gol até o 45\')', r.t1], ['2ºT (1º gol depois do 45\')', r.t2]].forEach(([rotuloTempo, res])=>{
        if(!res) return;
        linhas.push({ liga, linha, rotuloTempo, mediaPrimeiro: res.mediaPrimeiro, mediaBateu: res.mediaBateu, qtd: res.qtd, pct: res.pct });
      });
    });
  });
  return linhas;
}
window.computeTempoGolTabela = computeTempoGolTabela;

function computeLigas(filtroTipo, filtroCamp){
  const d = bpLoad();
  let entradas = (d.entradas||[]).filter(e=>e.liga && e.mercado && (e.tipoAposta||'simples')==='simples');
  if(filtroTipo) entradas = entradas.filter(e=>(e.tipo||'prelive')===filtroTipo);
  if(filtroCamp) entradas = entradas.filter(e=>e.liga===filtroCamp);
  if(!entradas.length) return [];

  const grupos = {};
  entradas.forEach(e=>{
    const tipo = e.tipo || 'prelive';
    const key = `${e.liga}|||${tipo}|||${e.mercado}`;
    (grupos[key] = grupos[key] || []).push(e);
  });

  const linhas = Object.entries(grupos).map(([key, lista])=>{
    const [liga, tipo, mercado] = key.split('|||');
    const minutos = lista.filter(e=>e.minuto!=null).map(e=>e.minuto);
    const minMedio = minutos.length ? Math.round(minutos.reduce((a,b)=>a+b,0)/minutos.length) : null;
    const oddMedia = r2(lista.reduce((a,e)=>a+e.odd,0)/lista.length);
    const greens = lista.filter(e=>e.resultado==='green').length;
    const reds   = lista.filter(e=>e.resultado==='red').length;
    const validas = greens+reds;
    const pctAcerto = validas ? Math.round((greens/validas)*100) : null;
    return { liga, tipo, mercado, minMedio, oddMedia, qtd:lista.length, pctAcerto, greens, reds };
  });
  linhas.sort((a,b)=> a.liga.localeCompare(b.liga,'pt-BR',{numeric:true}) || a.tipo.localeCompare(b.tipo) || a.mercado.localeCompare(b.mercado));
  return linhas;
}
window.computeLigas = computeLigas;

// ══ HISTÓRICO DE ENTRADAS (Apostas → Resolvidas) — versão PURA, sem DOM ══
// Usada pelo componente React src/components/Resolvidas.jsx. filtro: { modo:''|'dia'|'periodo', dia, de, ate }
function computeHistoricoEntradas(filtro){
  const d = bpLoad();
  filtro = filtro || {};
  let entradasFiltradas = d.entradas;
  if(filtro.modo==='dia' && filtro.dia){
    entradasFiltradas = d.entradas.filter(e=>e.data===filtro.dia);
  } else if(filtro.modo==='periodo'){
    if(filtro.de)  entradasFiltradas = entradasFiltradas.filter(e=>e.data && e.data>=filtro.de);
    if(filtro.ate) entradasFiltradas = entradasFiltradas.filter(e=>e.data && e.data<=filtro.ate);
  }
  return entradasFiltradas;
}
window.computeHistoricoEntradas = computeHistoricoEntradas;
