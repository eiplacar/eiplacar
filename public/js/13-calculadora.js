// ═══════════════════════════════════════════════════
// ABA CALCULADORA — cálculo de entrada, lançar entrada (simples/dupla/múltipla/outros)
// (cadastro de participantes/depósitos/retiradas foi removido — a Banca agora é uma
// carteira individual só, gerenciada em 14-banca-gestao.js / src/components/Banca.jsx)
// ═══════════════════════════════════════════════════
// ══ ENTRADA ══

// Ao digitar a Liga, mostra os times daquele campeonato nos selects de Mandante/Visitante
// (usa o mesmo jogosCache já carregado pela Aba Dados — nada de API aqui).
function popularTimesLigaEntrada(){
  const liga = document.getElementById('eLiga')?.value.trim();
  const wrap = document.getElementById('blocoJogoEntrada');
  const selM = document.getElementById('eMandanteSel');
  const selV = document.getElementById('eVisitanteSel');
  if(!wrap || !selM || !selV) return;
  if(!liga){ wrap.style.display='none'; return; }
  const times = [...new Set(jogosCache.filter(j=>j.camp===liga).flatMap(j=>[j.casa,j.vis]))].sort();
  if(!times.length){ wrap.style.display='none'; return; }
  const valM = selM.value, valV = selV.value;
  selM.innerHTML = '<option value="">Mandante</option>' + times.map(t=>`<option value="${t}">${t}</option>`).join('');
  selV.innerHTML = '<option value="">Visitante</option>' + times.map(t=>`<option value="${t}">${t}</option>`).join('');
  if(times.includes(valM)) selM.value = valM;
  if(times.includes(valV)) selV.value = valV;
  wrap.style.display = 'block';
  atualizarTimesEntrada();
}

// Junta Mandante + Visitante escolhidos em #eTimes (usado no resumo, na descrição e no lançamento)
function atualizarTimesEntrada(){
  const m = document.getElementById('eMandanteSel')?.value || '';
  const v = document.getElementById('eVisitanteSel')?.value || '';
  const eTimes = document.getElementById('eTimes');
  if(eTimes) eTimes.value = (m && v) ? `${m} × ${v}` : (m || v || '');
  atualizarResumoEntrada();
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
    liga    ? `Liga: ${liga}` : null,
    times   ? `Times: ${times}` : null,
    mercado ? `Mercado: ${mercado}` : null,
    tipo==='live' ? `Ao vivo${minuto?' • '+minuto+"'":''}` : `Pré-live`,
  ].filter(Boolean);
  el.innerHTML = linhas.map(l=>`<div>${l}</div>`).join('');
}

function setPct(pct, ev){
  document.getElementById('ePct').value=pct;
  const valorEl = document.getElementById('eValorStake'); if(valorEl) valorEl.value=''; // limpa o campo de R$, já que agora é % fixa
  document.querySelectorAll('.btn-pct').forEach(b=>b.classList.remove('ativo'));
  (ev || window.event)?.target.classList.add('ativo');
  calcEntrada();
}

// Pessoa digita o valor em R$ que quer apostar (o "Stake", em vez de calcular a % de cabeça) —
// aqui a gente traduz esse valor pra % da banca, que é o que o resto do sistema
// (cálculo de lucro, histórico, etc) já usa por baixo dos panos.
function setValorStake(valorStr){
  const d = bpLoad();
  const tot = d.saldo||0;
  const valor = numBR(valorStr);
  if(!tot || !valor){
    document.getElementById('ePct').value='';
    calcEntrada();
    return;
  }
  const pct = Math.round((valor/tot*100)*100)/100; // 2 casas decimais
  document.getElementById('ePct').value = pct;
  calcEntrada();
}

// Ganhos digitados direto (R$) — em vez de a pessoa calcular a odd de cabeça, ela digita
// quanto ganhou e o sistema descobre a odd equivalente a partir do Stake já preenchido
// (guardada em #eOdd, que é o que o resto do sistema já usa por baixo dos panos).
function setGanhoDireto(valorStr){
  const ganho = parseFloat(valorStr);
  const oddEl = document.getElementById('eOdd');
  const d = bpLoad();
  const tot = d.saldo||0;
  const pct = parseFloat(document.getElementById('ePct').value);
  const stake = tot && pct ? Math.round(tot*pct/100*100)/100 : 0;
  if(!stake || isNaN(ganho) || valorStr===''){
    if(oddEl){ oddEl.readOnly = tipoAposta!=='simples' ? true : false; oddEl.style.opacity = tipoAposta!=='simples' ? '.7' : '1'; }
    calcEntrada();
    return;
  }
  const odd = Math.round(((stake+ganho)/stake)*100)/100;
  if(oddEl){ oddEl.value = odd; oddEl.readOnly = true; oddEl.style.opacity = '.7'; }
  calcEntrada();
}

// Se a pessoa volta a editar a Odd na mão, o valor digitado em Ganhos perde a validade.
function limparGanhoDireto(){
  const gEl = document.getElementById('eGanhoDireto');
  if(gEl && gEl.value) gEl.value = '';
}

// Fica true assim que a pessoa digita algo no campo Retorno (correção manual, ex: a casa
// pagou um valor diferente do calculado pela odd). Enquanto for true, o Resumo usa o valor
// que ela digitou; se ela apagar o campo, volta a calcular sozinho a partir de Stake × Odd.
let retornoEditadoManualmente = false;

// oninput do campo #eRetorno
function editarRetorno(valorStr){
  retornoEditadoManualmente = valorStr.trim() !== '';
  calcEntrada();
}

function calcEntrada(){
  const retornoInputEl = document.getElementById('eRetorno');

  // Sistema: não usa % da banca nem odd — o Retorno vem direto de Stake + Lucro informados.
  if(tipoAposta==='sistema'){
    const el = document.getElementById('entradaPreview');
    if(!el) return;
    const stake = numBR(document.getElementById('eSistemaStake')?.value) || 0;
    const lucro = numBR(document.getElementById('eSistemaLucro')?.value) || 0;
    if(!stake && !lucro){ el.innerHTML = 'Preencha o Valor Investido e o Lucro para ver o resumo'; return; }
    const pctStake = stake ? Math.round((lucro/stake*100)*10)/10 : null;
    el.innerHTML=`<div style="display:flex;flex-direction:column;gap:9px">
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--texto2)">Lucro</span><strong style="color:#4dd87a">R$ ${lucro.toFixed(2).replace('.',',')}</strong></div>
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--texto2)">% sobre a Stake</span><strong style="color:${pctStake!=null&&pctStake<0?'var(--perigo)':'#4dd87a'}">${pctStake!=null?pctStake.toFixed(1).replace('.',','):'0,0'}%</strong></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:9px;border-top:1px solid var(--c3)"><span style="color:var(--texto2)">Retorno Total</span><strong style="color:var(--ouro)">R$ ${(stake+lucro).toFixed(2).replace('.',',')}</strong></div>
    </div>`;
    return;
  }

  const d = bpLoad();
  const tot = d.saldo||0;
  const pct = parseFloat(document.getElementById('ePct').value);
  const odd = numBR(document.getElementById('eOdd')?.value);
  const el  = document.getElementById('entradaPreview');
  if(!el) return;
  if(!tot){ el.innerHTML='<span style="color:var(--perigo)">Saldo da carteira zerado — faça um depósito na aba Banca</span>'; return; }
  if(!pct){ el.innerHTML='Preencha o Stake e a Odd para ver o resumo'; return; }
  const stake = Math.round(tot*pct/100*100)/100;

  // Retorno: se a pessoa corrigiu na mão (ex: viu que a casa pagou um valor diferente),
  // usa esse valor exato; senão calcula sozinho a partir de Stake × Odd, igual sempre.
  const retornoManualNum = numBR(retornoInputEl?.value);
  const usandoManual = retornoEditadoManualmente && !isNaN(retornoManualNum);
  const retorno = usandoManual ? Math.round(retornoManualNum*100)/100 : (odd && !isNaN(odd) ? Math.round(stake*odd*100)/100 : null);
  const lucro = retorno!=null ? Math.round((retorno-stake)*100)/100 : null;
  const pctStake = (lucro!=null && stake) ? Math.round((lucro/stake*100)*10)/10 : null;

  // Preenche o campo Retorno sozinho — só quando NÃO é uma correção manual (senão apagaria
  // o que a pessoa acabou de digitar enquanto ela ainda está no meio de editar o valor).
  if(!usandoManual && retornoInputEl && retorno!=null) retornoInputEl.value = retorno.toFixed(2).replace('.',',');

  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:9px">
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--texto2)">Lucro</span><strong style="color:#4dd87a">R$ ${lucro!=null?lucro.toFixed(2).replace('.',','):'0,00'}</strong></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--texto2)">% sobre a Stake</span><strong style="color:${pctStake!=null&&pctStake<0?'var(--perigo)':'#4dd87a'}">${pctStake!=null?pctStake.toFixed(1).replace('.',','):'0,0'}%</strong></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--texto2)">% Banca</span><strong>${pct}%</strong></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:9px;border-top:1px solid var(--c3)"><span style="color:var(--texto2)">Retorno Total</span><strong style="color:var(--ouro)">R$ ${retorno!=null?retorno.toFixed(2).replace('.',','):stake.toFixed(2).replace('.',',')}</strong></div>
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

// Bet (casa de apostas normal) ou Exchange (corretora tipo Betfair) — por enquanto só
// fica salvo junto com a entrada, sem afetar o cálculo.
function setOperacao(tipo){
  const el = document.getElementById('eOperacao'); if(el) el.value = tipo;
  const bet  = document.getElementById('btnOperacaoBet');
  const exch = document.getElementById('btnOperacaoExchange');
  if(!bet || !exch) return;
  if(tipo==='bet'){
    bet.style.borderColor='var(--verde2)'; bet.style.background='rgba(37,163,82,.15)'; bet.style.color='var(--verde2)';
    exch.style.borderColor='var(--c3)';    exch.style.background='var(--c1)';           exch.style.color='var(--texto2)';
  } else {
    exch.style.borderColor='var(--ouro)'; exch.style.background='rgba(245,197,24,.15)'; exch.style.color='var(--ouro)';
    bet.style.borderColor='var(--c3)';    bet.style.background='var(--c1)';              bet.style.color='var(--texto2)';
  }
}

// ══ SIMPLES / DUPLA / MÚLTIPLA / SISTEMA ══
let tipoAposta = 'simples';
let pernas = [];

function setTipoAposta(tipo){
  tipoAposta = tipo;
  const botoes = { simples:'btnApostaSimples', dupla:'btnApostaDupla', multipla:'btnApostaMultipla', sistema:'btnApostaSistema' };
  Object.entries(botoes).forEach(([t,id])=>{
    const b = document.getElementById(id);
    if(!b) return;
    if(t===tipo){ b.style.borderColor='var(--verde2)'; b.style.background='rgba(37,163,82,.15)'; b.style.color='var(--verde2)'; }
    else        { b.style.borderColor='var(--c3)';     b.style.background='var(--c1)';           b.style.color='var(--texto2)'; }
  });

  document.getElementById('blocoMercadoSimples').style.display = tipo==='simples' ? 'block' : 'none';
  document.getElementById('blocoPernas').style.display         = (tipo==='dupla'||tipo==='multipla') ? 'block' : 'none';
  document.getElementById('btnAddPerna').style.display          = tipo==='multipla' ? 'block' : 'none';
  const blocoSistemaEl = document.getElementById('blocoSistema');
  if(blocoSistemaEl) blocoSistemaEl.style.display = tipo==='sistema' ? 'block' : 'none';

  // Sistema pede o valor investido e o lucro direto — não usa Stake/Odd, Ganhos, Retorno nem o Resumo da Operação
  ['blocoPctBanca','blocoGestaoEntrada','blocoGanhoDireto','blocoRetornoEntrada'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.style.display = tipo==='sistema' ? 'none' : '';
  });

  const eOddEl = document.getElementById('eOdd');
  eOddEl.readOnly = tipo!=='simples';
  eOddEl.style.opacity = tipo!=='simples' ? '.7' : '1';
  const eGanhoEl = document.getElementById('eGanhoDireto');
  if(eGanhoEl) eGanhoEl.value = '';

  if(tipo==='sistema'){
    document.getElementById('eMercado').value = 'Sistema';
    calcEntrada();
    atualizarResumoEntrada();
    return;
  }

  if(tipo==='simples'){
    document.getElementById('eMercado').value = '';
    eOddEl.value = '';
    calcEntrada();
    atualizarResumoEntrada();
    return;
  }

  // Ao entrar em Dupla/Múltipla, reseta o "mesmo jogo?" — evita herdar um confronto de outro mercado
  document.getElementById('mesmoJogoCheck').checked = false;
  document.getElementById('eTimesCombo').value = '';
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
    // não zera #eTimes aqui — se a pessoa já escolheu Mandante/Visitante lá em cima, mantém
  }
  atualizarResumoEntrada();
}

function adicionarPerna(){
  if(tipoAposta!=='multipla') return;
  pernas.push({ id:Date.now(), mercado:'', odd:'' });
  renderPernas();
  atualizarCombinada();
}
function removerPerna(id){
  if(pernas.length<=2){ toast('Mínimo 2 mercados numa combinada'); return; }
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
    ${(tipoAposta==='multipla' && pernas.length>2) ? `<button type="button" onclick="removerPerna(${p.id})" style="background:none;border:1px solid var(--perigo);border-radius:6px;padding:8px 10px;color:var(--perigo);cursor:pointer;flex-shrink:0">✕</button>` : ''}
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
  const mercado  = document.getElementById('eMercado').value.trim();
  const liga     = document.getElementById('eLiga').value.trim();
  const times    = document.getElementById('eTimes').value.trim();
  const tipo     = document.getElementById('eTipo').value || 'prelive';
  const operacao = document.getElementById('eOperacao')?.value || 'bet';
  const desc     = mercado + (times?' · '+times:'') + (liga?' · '+liga:'');
  const res      = document.getElementById('eResultado').value;
  if(!res)  { toast('Selecione o resultado'); return; }

  // Sistema: valor investido e lucro são digitados direto, sem % da banca nem odd.
  // Os outros tipos continuam pelo fluxo de sempre (% da banca + odd).
  let pct, odd, stake, lucroInformado = 0;
  if(tipoAposta==='sistema'){
    stake = numBR(document.getElementById('eSistemaStake').value);
    lucroInformado = numBR(document.getElementById('eSistemaLucro').value) || 0;
    if(!stake){ toast('Informe o valor investido'); return; }
    const dPreview = bpLoad();
    pct = dPreview.saldo ? Math.round((stake/dPreview.saldo*100)*100)/100 : 0;
    odd = stake ? Math.round(((stake+lucroInformado)/stake)*100)/100 : null;
  } else {
    if(!mercado){ toast('Informe o mercado'); return; }
    pct = parseFloat(document.getElementById('ePct').value);
    odd = numBR(document.getElementById('eOdd').value);
    if(!pct)  { toast('Informe a % da banca ou o Stake'); return; }
    if(!odd)  { toast('Informe a odd'); return; }
  }

  // Confirmação final — modal customizado (evita bug de path no Android)
  const rotuloTipo = tipo==='live' ? `LIVE — minuto ${document.getElementById('eMinuto').value||'?'}'` : 'PRÉ-LIVE';
  const rotuloAposta = { simples:'Simples', dupla:'Dupla (2 mercados)', multipla:`Múltipla (${pernas.length} mercados)`, sistema:'Sistema' }[tipoAposta];
  const linhas = [
    `<strong>Aposta:</strong> ${rotuloAposta}`,
    `<strong>Operação:</strong> ${operacao==='bet'?'Bet':'Exchange'}`,
    `<strong>Mercado:</strong> ${mercado}${times?' ('+times+')':''}`,
    `<strong>Tipo:</strong> ${rotuloTipo}`,
    tipoAposta==='sistema' ? `<strong>Valor Investido:</strong> R$ ${stake.toFixed(2)}` : `<strong>Odd:</strong> ${odd}`,
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
  if(tot<=0){ toast('Saldo da carteira zerado — faça um depósito na aba Banca'); return; }
  if(tipoAposta!=='sistema') stake = Math.round(tot*pct/100*100)/100;
  // Cash Out não é um resultado à parte pra fins de estatística — vira Green ou Red na
  // hora de salvar, comparando o que a pessoa realmente recebeu (Retorno) com o Stake:
  // recebeu mais que apostou = Green; recebeu menos = Red; exatamente igual = Void
  // (nem ganhou nem perdeu). Sem isso, o Cash Out ficava de fora da taxa de acerto e
  // do gráfico de Evolução, que só contavam resultado==='green'/'red'.
  const retornoInformadoEl = numBR(document.getElementById('eRetorno')?.value);
  let resFinal = res;
  if(res==='cashout'){
    if(!retornoInformadoEl){ toast('Informe o Retorno recebido no Cash Out'); return; }
    resFinal = retornoInformadoEl > stake ? 'green' : (retornoInformadoEl < stake ? 'red' : 'void');
  }
  const contaComoGreen = resFinal==='green';
  const lucroB  = contaComoGreen
    ? (tipoAposta==='sistema' ? lucroInformado : (retornoInformadoEl>0 ? Math.round((retornoInformadoEl-stake)*100)/100 : Math.round(stake*(odd-1)*100)/100))
    : 0;
  const protecaoAtiva = d.protecaoAtiva!==false;
  const protecaoPct   = d.protecaoPct??10;
  // Green: parte do lucro vai automaticamente pra Reserva (proteção da banca), o resto fica na Carteira.
  // Cash Out: mesma lógica do Green/Red conforme resFinal acima, com o valor que a pessoa realmente recebeu (Retorno).
  // Red: o stake sai direto da Carteira. Void: não mexe em nada.
  const reservaCorte  = (contaComoGreen && lucroB>0) ? Math.round(lucroB*(protecaoAtiva?protecaoPct:0)/100*100)/100 : 0;
  const ganhoCarteira = contaComoGreen ? Math.round((lucroB-reservaCorte)*100)/100 : 0;
  // Red "normal" perde o stake inteiro; Cash Out no prejuízo (resFinal='red' vindo de cashout)
  // só perde a diferença entre o que apostou e o que recebeu de volta — por isso usa o Retorno
  // informado, não o stake cheio.
  const percaCarteira = resFinal==='red' ? (res==='cashout' ? Math.max(0, Math.round((stake-retornoInformadoEl)*100)/100) : stake) : 0;

  d.reserva = Math.round(((d.reserva||0)+reservaCorte)*100)/100;
  d.saldo   = Math.round(((d.saldo||0)+ganhoCarteira-percaCarteira)*100)/100;
  d.entradas.unshift({
    id:Date.now(), desc, pct, odd, stake, resultado:resFinal, foiCashout: res==='cashout', operacao,
    lucro:lucroB, reservaCorte, ganhoCarteira, percaCarteira,
    liga, mercado, times, tipo, tipoAposta,
    minuto: tipo==='live' ? (parseInt(document.getElementById('eMinuto').value)||null) : null,
    data: document.getElementById('eDataEntrada').value || hojeBR() // corrigido pro fuso de Brasília (ver 04-utils.js)
  });
  bpSave(d);

  ['ePct','eValorStake','eOdd','eRetorno','eGanhoDireto','eLiga','eMercado','eMinuto','eTimes','eTimesCombo','eSistemaStake','eSistemaLucro'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  retornoEditadoManualmente = false;
  const mjEl=document.getElementById('mesmoJogoCheck'); if(mjEl) mjEl.checked=false;
  const erEl=document.getElementById('eResultado'); if(erEl) erEl.value='';
  const selM=document.getElementById('eMandanteSel'); if(selM) selM.innerHTML='<option value="">Mandante</option>';
  const selV=document.getElementById('eVisitanteSel'); if(selV) selV.innerHTML='<option value="">Visitante</option>';
  const wrapJogo=document.getElementById('blocoJogoEntrada'); if(wrapJogo) wrapJogo.style.display='none';
  setOperacao('bet');
  setTipoEntrada('prelive');
  pernas = [];
  setTipoAposta('simples');
  const eDataEl=document.getElementById('eDataEntrada'); if(eDataEl) eDataEl.value=hojeBR(); // corrigido pro fuso de Brasília (ver 04-utils.js)
  const epEl=document.getElementById('entradaPreview'); if(epEl) epEl.innerHTML='Preencha o Stake e a Odd para ver o resumo';
  const rdEl=document.getElementById('retornoDisplay'); if(rdEl) rdEl.textContent='—';
  document.querySelectorAll('.btn-pct').forEach(b=>b.classList.remove('ativo'));
  atualizarResumoEntrada();

  window.resolvidasRefresh?.();
  window.bancaRefresh?.();
  toast(res==='green'?'Green!':res==='red'?'Red!':res==='void'?'Void!':`Cash Out registrado (${resFinal==='green'?'Green':resFinal==='red'?'Red':'Void'})`);
}

function excluirEntrada(id){
  document.getElementById('modalConfirmarExclusao').classList.add('open');
  document.getElementById('modalExclusaoOk').onclick = () => {
    document.getElementById('modalConfirmarExclusao').classList.remove('open');
    const d = bpLoad();
    const e = d.entradas.find(x=>x.id===id);
    if(e){
      if(contaComoGreenEntrada(e)){
        d.reserva = Math.round(((d.reserva||0)-(e.reservaCorte||0))*100)/100;
        d.saldo   = Math.round(((d.saldo||0)-(e.ganhoCarteira||0))*100)/100;
      } else if(e.resultado==='red'){
        d.saldo   = Math.round(((d.saldo||0)+(e.percaCarteira??e.stake??0))*100)/100;
      }
      d.entradas = d.entradas.filter(x=>x.id!==id);
    }
    bpSave(d);
    window.resolvidasRefresh?.();
    window.bancaRefresh?.();
    toast('Entrada removida');
  };
  document.getElementById('modalExclusaoCancelar').onclick = () => {
    document.getElementById('modalConfirmarExclusao').classList.remove('open');
  };
}

// ══ EDITAR ENTRADA (corrige mercado, odd, resultado, data etc. de um lançamento já feito) ══
let idEntradaEmEdicao = null;
let editERetornoManual = false; // true assim que a pessoa mexe direto no campo Retorno (correção manual)
function editarEntrada(id){
  toastEsconder();
  const d = bpLoad();
  const e = d.entradas.find(x=>x.id===id);
  if(!e) return;
  idEntradaEmEdicao = id;
  editERetornoManual = false;
  document.getElementById('editEMercado').value   = e.mercado || '';
  document.getElementById('editETipoAposta').value = e.tipoAposta || 'simples';
  document.getElementById('editELiga').value      = e.liga || '';
  document.getElementById('editETimes').value     = e.times || '';
  document.getElementById('editETipo').value      = e.tipo || 'prelive';
  document.getElementById('editEMinuto').value    = e.minuto || '';
  document.getElementById('editEMinutoWrap').style.display = (e.tipo==='live') ? 'block' : 'none';
  document.getElementById('editEOdd').value       = e.odd || '';
  document.getElementById('editEStake').value     = e.stake || '';
  // Retorno já salvo — fórmula única que vale pra Green, Red, Void e Cash Out (resolvido em
  // qualquer um desses três na hora de salvar): o que a pessoa recebeu de volta é
  // Stake + Lucro − Perda (só um dos dois nunca é zero, dependendo do resultado).
  const retornoSalvo = (e.stake||0) + (e.lucro||0) - valorPerdaEntrada(e);
  document.getElementById('editERetorno').value = retornoSalvo ? retornoSalvo.toFixed(2).replace('.',',') : '';
  document.getElementById('editEResultado').value = e.foiCashout ? 'cashout' : (e.resultado || 'green');
  document.getElementById('editEData').value      = e.data || '';
  document.getElementById('modalEditarEntrada').classList.add('open');
}
// oninput de Odd/Valor Apostado: recalcula o Retorno sozinho, a não ser que a pessoa já tenha corrigido ele na mão
function editECalcularRetorno(){
  if(editERetornoManual) return;
  const odd   = numBR(document.getElementById('editEOdd').value);
  const stake = numBR(document.getElementById('editEStake').value);
  const el = document.getElementById('editERetorno');
  el.value = (odd>0 && stake>0) ? (odd*stake).toFixed(2).replace('.',',') : '';
}
// oninput do próprio campo Retorno: marca como correção manual, pra não sobrescrever mais sozinho
function editERetornoEditadoManual(){
  editERetornoManual = true;
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
  const novoOdd      = numBR(document.getElementById('editEOdd').value);
  const novoStakeInformado = numBR(document.getElementById('editEStake').value);
  const novoRes      = document.getElementById('editEResultado').value;
  const novaData     = document.getElementById('editEData').value || antiga.data;

  if(!novoMercado){ toast('Informe o mercado'); return; }
  if(!novoOdd)     { toast('Informe a odd'); return; }
  if(!novoStakeInformado || novoStakeInformado<=0) { toast('Informe o valor apostado'); return; }

  // Reverte o efeito antigo na carteira/reserva e remove a entrada, pra recalcular do zero
  if(contaComoGreenEntrada(antiga)){
    d.reserva = Math.round(((d.reserva||0)-(antiga.reservaCorte||0))*100)/100;
    d.saldo   = Math.round(((d.saldo||0)-(antiga.ganhoCarteira||0))*100)/100;
  } else if(antiga.resultado==='red'){
    d.saldo   = Math.round(((d.saldo||0)+valorPerdaEntrada(antiga))*100)/100;
  }
  d.entradas.splice(idx,1);

  const tot   = d.saldo||0;
  const stake = Math.round(novoStakeInformado*100)/100;
  const pct   = tot>0 ? Math.round((stake/tot)*1000)/10 : antiga.pct;
  // Retorno: se a pessoa corrigiu na mão (ex: a casa pagou um valor diferente do Stake × Odd,
  // ou é um Cash Out — que só existe com valor informado na mão mesmo), usa o que tá no campo;
  // senão cai no cálculo padrão Stake × Odd.
  const retornoInformado = numBR(document.getElementById('editERetorno').value);
  const retorno = retornoInformado>0 ? retornoInformado : stake*novoOdd;
  // Cash Out não é resultado à parte pra fins de cálculo — vira Green/Red/Void aqui, comparando
  // o Retorno com o Stake, do mesmo jeito que em lancarEntrada() (ver comentário lá).
  let resFinal = novoRes;
  if(novoRes==='cashout'){
    resFinal = retorno > stake ? 'green' : (retorno < stake ? 'red' : 'void');
  }
  const contaComoGreen = resFinal==='green';
  const lucroB = contaComoGreen ? Math.round((retorno-stake)*100)/100 : 0;
  const protecaoAtiva = d.protecaoAtiva!==false;
  const protecaoPct   = d.protecaoPct??10;
  // Reserva só corta em cima de lucro de verdade (se o cash out saiu no prejuízo, não tira reserva)
  const reservaCorte  = (contaComoGreen && lucroB>0) ? Math.round(lucroB*(protecaoAtiva?protecaoPct:0)/100*100)/100 : 0;
  const ganhoCarteira = contaComoGreen ? Math.round((lucroB-reservaCorte)*100)/100 : 0;
  // Red "normal" perde o stake inteiro; Cash Out no prejuízo só perde a diferença entre o
  // que apostou e o que recebeu de volta (Retorno) — não o stake cheio.
  const percaCarteira = resFinal==='red' ? (novoRes==='cashout' ? Math.max(0, Math.round((stake-retorno)*100)/100) : stake) : 0;

  d.reserva = Math.round(((d.reserva||0)+reservaCorte)*100)/100;
  d.saldo   = Math.round(((d.saldo||0)+ganhoCarteira-percaCarteira)*100)/100;

  const desc = novoMercado + (novoTimes?' · '+novoTimes:'') + (novoLiga?' · '+novoLiga:'');
  d.entradas.splice(idx, 0, {
    ...antiga,
    desc, mercado:novoMercado, tipoAposta:novoTipoAposta, liga:novoLiga, times:novoTimes, tipo:novoTipo, minuto:novoMinuto,
    odd:novoOdd, resultado:resFinal, foiCashout: novoRes==='cashout', stake, pct, lucro:lucroB, reservaCorte, ganhoCarteira, percaCarteira,
    data:novaData
  });

  bpSave(d);
  fecharModalEditarEntrada();
  window.resolvidasRefresh?.();
  window.bancaRefresh?.();
  toast('Entrada atualizada');
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

  tbody.innerHTML = linhasHtml || `<tr><td colspan="7"><div class="empty"><div class="icon"></div><p>Nenhum jogo com gols por minuto cadastrados bateu esses Overs ainda.</p></div></td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="icon"></div><p>Nenhuma entrada com Liga e Mercado preenchidos ainda. Lance entradas na Calculadora informando esses campos.</p></div></td></tr>`;
    return;
  }

  // Agrupa por Liga + Tipo (prelive/live) + Mercado
  // Só entram aqui entradas Simples — Dupla/Múltipla/Sistema não alimentam essa tabela
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
    const greens = lista.filter(e=>contaComoGreenEntrada(e)).length;
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
      <td>${l.tipo==='live'?'Live':'Pré-live'}</td>
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
// "Ambas Marcam": o "gol que bate" é o gol que COMPLETA o BTTS — ou seja, o gol do time
// que demorou mais pra abrir o placar (o 1º gol de quem marcou por último entre os dois).
function calcularTempoGolBTTS(camp){
  const jogos = camp ? jogosCache.filter(j=>j.camp===camp) : jogosCache;
  const totalComDados = jogos.filter(j=>(j.gols||[]).some(g=>g.min!=null)).length;
  const reg1T = [], reg2T = [];
  jogos.forEach(j=>{
    if(!(j.gC>0 && j.gV>0)) return; // só jogos com ambas equipes marcando
    const golsCasa = (j.gols||[]).filter(g=>g.time==='casa' && g.min!=null).map(g=>g.min);
    const golsVis  = (j.gols||[]).filter(g=>g.time==='vis'  && g.min!=null).map(g=>g.min);
    if(!golsCasa.length || !golsVis.length) return; // sem dados de minuto suficientes
    const primeiroCasa = Math.min(...golsCasa);
    const primeiroVis  = Math.min(...golsVis);
    const primeiro = Math.min(primeiroCasa, primeiroVis);
    const bateu = Math.max(primeiroCasa, primeiroVis); // gol que fechou o BTTS
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

function computeTempoGolTabela(camp, filtroMercado){
  const ligas = camp ? [camp] : sortNatural([...new Set(jogosCache.map(j=>j.camp))]);
  const linhasDef = [1.5, 2.5, 3.5, 4.5];
  const linhas = [];
  const mostrarGols = !filtroMercado || filtroMercado==='gols';
  const mostrarBtts = !filtroMercado || filtroMercado==='gols'; // Ambas Marcam também é mercado de gol
  ligas.forEach(liga=>{
    if(mostrarGols) linhasDef.forEach(linha=>{
      const r = calcularTempoGolLiga(liga, linha);
      [['1ºT (1º gol até o 45\')', r.t1], ['2ºT (1º gol depois do 45\')', r.t2]].forEach(([rotuloTempo, res])=>{
        if(!res) return;
        linhas.push({ liga, linha, mercado: `Over ${linha}`, rotuloTempo, mediaPrimeiro: res.mediaPrimeiro, mediaBateu: res.mediaBateu, qtd: res.qtd, pct: res.pct });
      });
    });
    if(mostrarBtts){
      const rb = calcularTempoGolBTTS(liga);
      [['1ºT (1º gol até o 45\')', rb.t1], ['2ºT (1º gol depois do 45\')', rb.t2]].forEach(([rotuloTempo, res])=>{
        if(!res) return;
        linhas.push({ liga, linha: 'btts', mercado: 'Ambas Marcam', rotuloTempo, mediaPrimeiro: res.mediaPrimeiro, mediaBateu: res.mediaBateu, qtd: res.qtd, pct: res.pct });
      });
    }
  });
  return linhas;
}
window.computeTempoGolTabela = computeTempoGolTabela;

// ══ JANELA DE ENTRADA (aba Estratégias → Linha do Tempo) ══
// Mesmíssimo cálculo de calcularTempoGolLiga()/calcularTempoGolBTTS() acima
// (que já usa os jogos cadastrados na Aba Dados, com os gols por minuto), só
// que aqui separa 1ºT/2ºT em duas listas prontas pra tabela, e aceita um
// filtro extra de "últimos N jogos da liga" (5/10/20) além de liga/mercado.
function jogosDaLigaFiltrados(camp, limite){
  let jogos = camp ? jogosCache.filter(j=>j.camp===camp) : jogosCache.slice();
  if(limite){
    // do mais antigo pro mais recente (data, id como desempate) e fica só com
    // os últimos N — assim "Últimos 10 jogos" pega os 10 mais recentes da liga
    jogos = [...jogos].sort((a,b)=> (a.data||'').localeCompare(b.data||'') || (a.id||0)-(b.id||0));
    jogos = jogos.slice(-limite);
  }
  return jogos;
}
function calcularJanelaLinha(jogos, linha){
  const totalComDados = jogos.filter(j=>(j.gols||[]).some(g=>g.min!=null)).length;
  const idxGolNecessario = Math.floor(linha+0.5);
  const reg1T = [], reg2T = [];
  jogos.forEach(j=>{
    const total = (j.gC||0)+(j.gV||0);
    if(total<=linha) return;
    const golsOrdenados = (j.gols||[]).map(g=>g.min).filter(m=>m!=null).sort((a,b)=>a-b);
    if(golsOrdenados.length<idxGolNecessario) return;
    const primeiro = golsOrdenados[0];
    const bateu = golsOrdenados[idxGolNecessario-1];
    (primeiro<=45 ? reg1T : reg2T).push({primeiro, bateu});
  });
  function resumo(reg){
    if(!reg.length) return null;
    return { qtd: reg.length, pct: totalComDados ? Math.round((reg.length/totalComDados)*100) : null,
      mediaPrimeiro: Math.round(reg.reduce((a,r)=>a+r.primeiro,0)/reg.length),
      mediaBateu:    Math.round(reg.reduce((a,r)=>a+r.bateu,0)/reg.length) };
  }
  return { t1: resumo(reg1T), t2: resumo(reg2T) };
}
function calcularJanelaBTTS(jogos){
  const totalComDados = jogos.filter(j=>(j.gols||[]).some(g=>g.min!=null)).length;
  const reg1T = [], reg2T = [];
  jogos.forEach(j=>{
    if(!(j.gC>0 && j.gV>0)) return;
    const golsCasa = (j.gols||[]).filter(g=>g.time==='casa' && g.min!=null).map(g=>g.min);
    const golsVis  = (j.gols||[]).filter(g=>g.time==='vis'  && g.min!=null).map(g=>g.min);
    if(!golsCasa.length || !golsVis.length) return;
    const primeiroCasa = Math.min(...golsCasa), primeiroVis = Math.min(...golsVis);
    const primeiro = Math.min(primeiroCasa, primeiroVis), bateu = Math.max(primeiroCasa, primeiroVis);
    (primeiro<=45 ? reg1T : reg2T).push({primeiro, bateu});
  });
  function resumo(reg){
    if(!reg.length) return null;
    return { qtd: reg.length, pct: totalComDados ? Math.round((reg.length/totalComDados)*100) : null,
      mediaPrimeiro: Math.round(reg.reduce((a,r)=>a+r.primeiro,0)/reg.length),
      mediaBateu:    Math.round(reg.reduce((a,r)=>a+r.bateu,0)/reg.length) };
  }
  return { t1: resumo(reg1T), t2: resumo(reg2T) };
}
// filtros: { camp:'', mercadoLinha:''|'1.5'|'2.5'|'3.5'|'4.5'|'btts', limite:0|5|10|20 }
// Retorna { t1:[...linhas], t2:[...linhas] } — cada linha: {liga, mercado, mediaPrimeiro, mediaBateu, qtd, pct}
function computeJanelaEntrada(filtros){
  filtros = filtros || {};
  const camp = filtros.camp || '';
  const mercadoLinha = filtros.mercadoLinha || '';
  const limite = filtros.limite || 0;
  const ligas = camp ? [camp] : sortNatural([...new Set(jogosCache.map(j=>j.camp))]);
  const linhasDef = mercadoLinha === 'btts' ? [] : (mercadoLinha ? [parseFloat(mercadoLinha)] : [1.5,2.5,3.5,4.5]);
  const mostrarBtts = !mercadoLinha || mercadoLinha==='btts';
  const t1 = [], t2 = [];
  ligas.forEach(liga=>{
    const jogos = jogosDaLigaFiltrados(liga, limite);
    linhasDef.forEach(linha=>{
      const r = calcularJanelaLinha(jogos, linha);
      if(r.t1) t1.push({ liga, mercado:`Over ${linha}`, ...r.t1 });
      if(r.t2) t2.push({ liga, mercado:`Over ${linha}`, ...r.t2 });
    });
    if(mostrarBtts){
      const rb = calcularJanelaBTTS(jogos);
      if(rb.t1) t1.push({ liga, mercado:'Ambas Marcam', ...rb.t1 });
      if(rb.t2) t2.push({ liga, mercado:'Ambas Marcam', ...rb.t2 });
    }
  });
  return { t1, t2 };
}
window.computeJanelaEntrada = computeJanelaEntrada;

// ══ FAIXA DE CONFIRMAÇÃO (aba Estratégias → Cenários) ══
// Pergunta: "quando o placar tá X aos Y minutos, com que frequência o jogo
// confirma (bate) cada linha de Over até o fim?". Usa os mesmos jogos da Aba
// Dados, mas só entram os jogos com a cronologia de gols COMPLETA (todo gol do
// placar final tem minuto registrado) — senão não dá pra saber com certeza
// qual era o placar naquele minuto exato.
// filtros: { camp:'', limite:0|10|20, minuto:10..80, placar:'1x0' (casaXvisitante) }
// Retorna [{liga, mercado, cenario, jogos, confirmou, pct}, ...] — uma linha por Liga x Mercado
function computeFaixaConfirmacao(filtros){
  filtros = filtros || {};
  const camp = filtros.camp || '';
  const limite = filtros.limite || 0;
  const minuto = Number(filtros.minuto) || 30;
  const placar = filtros.placar || '0x0';
  const [pCasa, pVis] = placar.split('x').map(Number);
  const ligas = camp ? [camp] : sortNatural([...new Set(jogosCache.map(j=>j.camp))]);
  const linhasDef = [1.5, 2.5, 3.5, 4.5];
  const cenario = `${placar} aos ${minuto}'`;
  const linhas = [];
  ligas.forEach(liga=>{
    const jogos = jogosDaLigaFiltrados(liga, limite);
    // só jogos com a cronologia de gols 100% registrada (todo gol do placar final com minuto)
    const jogosCompletos = jogos.filter(j=>{
      const total = (j.gC||0)+(j.gV||0);
      return total>0 && (j.gols||[]).length===total && (j.gols||[]).every(g=>g.min!=null);
    });
    const jogosCenario = jogosCompletos.filter(j=>{
      const cCasa = (j.gols||[]).filter(g=>g.time==='casa' && g.min<=minuto).length;
      const cVis  = (j.gols||[]).filter(g=>g.time==='vis'  && g.min<=minuto).length;
      return cCasa===pCasa && cVis===pVis;
    });
    if(!jogosCenario.length) return; // sem jogos nesse cenário nessa liga, não polui a tabela
    linhasDef.forEach(linha=>{
      const confirmou = jogosCenario.filter(j=>((j.gC||0)+(j.gV||0))>linha).length;
      const pct = Math.round((confirmou/jogosCenario.length)*100);
      linhas.push({ liga, mercado:`Over ${linha}`, cenario, jogos:jogosCenario.length, confirmou, pct });
    });
  });
  return linhas;
}
window.computeFaixaConfirmacao = computeFaixaConfirmacao;

// Categoriza o texto livre do mercado como "Gols" ou "Escanteios" (cantos),
// pra dar pra filtrar a tabela por um ou por outro.
function categoriaMercado(mercado){
  const m = (mercado||'').toLowerCase();
  return (m.includes('canto') || m.includes('escanteio')) ? 'escanteios' : 'gols';
}
window.categoriaMercado = categoriaMercado;

function computeLigas(filtroTipo, filtroCamp, filtroMercado){
  const d = bpLoad();
  let entradas = (d.entradas||[]).filter(e=>e.liga && e.mercado && (e.tipoAposta||'simples')==='simples');
  if(filtroTipo) entradas = entradas.filter(e=>(e.tipo||'prelive')===filtroTipo);
  if(filtroCamp) entradas = entradas.filter(e=>e.liga===filtroCamp);
  if(filtroMercado) entradas = entradas.filter(e=>categoriaMercado(e.mercado)===filtroMercado);
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
    const greens = lista.filter(e=>contaComoGreenEntrada(e)).length;
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

// ═══════════════════════════════════════════════════════════════════════
// ══ SCORE DA ESTRATÉGIA (aba Estratégias → Equipes) ══
// Tudo calculado em cima dos jogos cadastrados na Aba Dados (jogosCache).
// ═══════════════════════════════════════════════════════════════════════

// Últimos N jogos de UM time específico (mandante ou visitante em qualquer
// jogo), do mais recente pro mais antigo, opcionalmente restrito a uma liga.
// modo: 'ambas' (padrão, casa+fora) | 'casa' (só jogos em casa) | 'fora' (só jogos fora)
function jogosDoTimeFiltrados(time, camp, limite, modo){
  let jogos = jogosCache.filter(j=>{
    if(!camp || j.camp===camp){
      if(modo==='casa') return j.casa===time;
      if(modo==='fora') return j.vis===time;
      return j.casa===time || j.vis===time;
    }
    return false;
  });
  jogos = [...jogos].sort((a,b)=> (b.data||'').localeCompare(a.data||'') || (b.id||0)-(a.id||0));
  if(limite) jogos = jogos.slice(0, limite);
  return jogos;
}

// Estatísticas recentes de UM time (na perspectiva dele, seja jogando em casa
// ou fora), usadas nos 4 primeiros critérios do Score + no comparativo.
// linhaOver: se informado, também calcula a taxa de confirmação daquele Over
// nos jogos do próprio time (usado no "Comparativo entre as Equipes").
function statsTimeRecente(time, camp, limite, linhaOver, modo){
  const jogos = jogosDoTimeFiltrados(time, camp, limite, modo);
  const n = jogos.length;
  const linhaBTTS = linhaOver==='btts';
  if(!n) return null;
  let vit=0, emp=0, der=0, somaRank=0, nRank=0, somaMarcados=0, somaSofridos=0,
      somaChutes=0, nChutes=0, somaChutesSofridos=0, nChutesSofridos=0,
      somaChutesGol=0, nChutesGol=0, somaChutesGolSofridos=0, nChutesGolSofridos=0,
      somaEscanteios=0, nEscanteios=0, somaCartoes=0, nCartoes=0,
      htVenceu=0, nHT=0, marca1T=0, marca2T=0, sofre2T=0,
      somaMinPrimeiroGol=0, nMinPrimeiroGol=0, over=0, ambasMarcaram=0;
  jogos.forEach(j=>{
    const isCasa = j.casa===time;
    const marcados = isCasa ? (j.gC||0) : (j.gV||0);
    const sofridos = isCasa ? (j.gV||0) : (j.gC||0);
    somaMarcados+=marcados; somaSofridos+=sofridos;
    if(marcados>sofridos) vit++; else if(marcados===sofridos) emp++; else der++;
    if(marcados>0 && sofridos>0) ambasMarcaram++;
    if(linhaBTTS){ if(marcados>0 && sofridos>0) over++; }
    else if(linhaOver!=null && (marcados+sofridos)>linhaOver) over++;
    const rank = isCasa ? j.rankC : j.rankV;
    if(rank!=null){ somaRank+=rank; nRank++; }
    const chutes = isCasa ? j.chutesC : j.chutesV, chutesAdv = isCasa ? j.chutesV : j.chutesC;
    if(chutes!=null){ somaChutes+=chutes; nChutes++; }
    if(chutesAdv!=null){ somaChutesSofridos+=chutesAdv; nChutesSofridos++; }
    const chutesGol = isCasa ? j.chutesGolC : j.chutesGolV, chutesGolAdv = isCasa ? j.chutesGolV : j.chutesGolC;
    if(chutesGol!=null){ somaChutesGol+=chutesGol; nChutesGol++; }
    if(chutesGolAdv!=null){ somaChutesGolSofridos+=chutesGolAdv; nChutesGolSofridos++; }
    const escanteios = isCasa ? j.escanteiosC : j.escanteiosV;
    if(escanteios!=null){ somaEscanteios+=escanteios; nEscanteios++; }
    const amarelos = isCasa ? j.amarelosC : j.amarelosV, vermelhos = isCasa ? j.vermelhosC : j.vermelhosV;
    if(amarelos!=null || vermelhos!=null){ somaCartoes += (amarelos||0)+(vermelhos||0)*2; nCartoes++; }
    const htProprio = isCasa ? j.golsHT_C : j.golsHT_V, htAdv = isCasa ? j.golsHT_V : j.golsHT_C;
    if(htProprio!=null && htAdv!=null){ nHT++; if(htProprio>htAdv) htVenceu++; }
    const golsProprios = (j.gols||[]).filter(g=> g.time===(isCasa?'casa':'vis'));
    const golsAdv       = (j.gols||[]).filter(g=> g.time===(isCasa?'vis':'casa'));
    if(golsProprios.some(g=>g.min!=null && g.min<=45)) marca1T++;
    if(golsProprios.some(g=>g.min!=null && g.min>45))  marca2T++;
    if(golsAdv.some(g=>g.min!=null && g.min>45))        sofre2T++;
    const minsProprios = golsProprios.map(g=>g.min).filter(m=>m!=null);
    if(minsProprios.length){ somaMinPrimeiroGol += Math.min(...minsProprios); nMinPrimeiroGol++; }
  });
  return {
    jogos:n, vitorias:vit, empates:emp, derrotas:der,
    avgRank: nRank ? somaRank/nRank : null,
    avgMarcados: somaMarcados/n, avgSofridos: somaSofridos/n,
    avgChutes: nChutes ? somaChutes/nChutes : null,
    avgChutesSofridos: nChutesSofridos ? somaChutesSofridos/nChutesSofridos : null,
    avgChutesGol: nChutesGol ? somaChutesGol/nChutesGol : null,
    avgChutesGolSofridos: nChutesGolSofridos ? somaChutesGolSofridos/nChutesGolSofridos : null,
    avgEscanteios: nEscanteios ? somaEscanteios/nEscanteios : null,
    avgCartoes: nCartoes ? somaCartoes/nCartoes : null,
    pctVenceHT: nHT ? Math.round((htVenceu/nHT)*100) : null,
    pctMarca1T: Math.round((marca1T/n)*100),
    pctMarca2T: Math.round((marca2T/n)*100),
    pctSofre2T: Math.round((sofre2T/n)*100),
    pctAmbasMarcam: Math.round((ambasMarcaram/n)*100),
    avgMinPrimeiroGol: nMinPrimeiroGol ? somaMinPrimeiroGol/nMinPrimeiroGol : null,
    pctOverLinha: linhaOver!=null ? Math.round((over/n)*100) : null,
  };
}
window.statsTimeRecente = statsTimeRecente;

// Tendência de mercado da LIGA inteira (não é por time): entre os jogos da
// liga (com o filtro de últimos N jogos), qual % bate a linha de Over
// escolhida, e em que minuto médio sai o 1º gol e o gol que confirma.
function tendenciaMercadoLiga(camp, limite, linha){
  const jogos = jogosDaLigaFiltrados(camp, limite);
  if(linha==='btts'){
    const comDados = jogos.filter(j=>(j.gols||[]).some(g=>g.min!=null));
    let confirmaram=0, somaPrimeiro=0, nPrimeiro=0, somaConfirma=0, nConfirma=0;
    comDados.forEach(j=>{
      const golsOrdenados = (j.gols||[]).map(g=>g.min).filter(m=>m!=null).sort((a,b)=>a-b);
      if(golsOrdenados.length){ somaPrimeiro += golsOrdenados[0]; nPrimeiro++; }
      const golsCasa = (j.gols||[]).filter(g=>g.time==='casa' && g.min!=null).map(g=>g.min);
      const golsVis  = (j.gols||[]).filter(g=>g.time==='vis'  && g.min!=null).map(g=>g.min);
      if((j.gC||0)>0 && (j.gV||0)>0 && golsCasa.length && golsVis.length){
        confirmaram++;
        somaConfirma += Math.max(Math.min(...golsCasa), Math.min(...golsVis));
        nConfirma++;
      }
    });
    return {
      jogos: comDados.length,
      pctConfirmacao: comDados.length ? Math.round((confirmaram/comDados.length)*100) : null,
      mediaPrimeiroGol: nPrimeiro ? Math.round(somaPrimeiro/nPrimeiro) : null,
      mediaConfirmacao: nConfirma ? Math.round(somaConfirma/nConfirma) : null,
    };
  }
  const idxNecessario = Math.floor(linha+0.5);
  const comDados = jogos.filter(j=>(j.gols||[]).some(g=>g.min!=null));
  let confirmaram=0, somaPrimeiro=0, nPrimeiro=0, somaConfirma=0, nConfirma=0;
  comDados.forEach(j=>{
    const total = (j.gC||0)+(j.gV||0);
    const golsOrdenados = (j.gols||[]).map(g=>g.min).filter(m=>m!=null).sort((a,b)=>a-b);
    if(golsOrdenados.length){ somaPrimeiro += golsOrdenados[0]; nPrimeiro++; }
    if(total>linha){
      confirmaram++;
      if(golsOrdenados.length>=idxNecessario){ somaConfirma += golsOrdenados[idxNecessario-1]; nConfirma++; }
    }
  });
  return {
    jogos: comDados.length,
    pctConfirmacao: comDados.length ? Math.round((confirmaram/comDados.length)*100) : null,
    mediaPrimeiroGol: nPrimeiro ? Math.round(somaPrimeiro/nPrimeiro) : null,
    mediaConfirmacao: nConfirma ? Math.round(somaConfirma/nConfirma) : null,
  };
}
window.tendenciaMercadoLiga = tendenciaMercadoLiga;

// Um único cenário (placar aos X') na liga toda — usado nos 3 cards
// "Cenários (Entrada no 1º Tempo)", cada um com o minuto editável pelo usuário.
function cenarioLiga(camp, limite, placar, minuto, linha){
  const [pCasa, pVis] = placar.split('x').map(Number);
  let jogos = jogosDaLigaFiltrados(camp, limite).filter(j=>{
    const total = (j.gC||0)+(j.gV||0);
    return total>0 && (j.gols||[]).length===total && (j.gols||[]).every(g=>g.min!=null);
  });
  jogos = [...jogos].sort((a,b)=> (a.data||'').localeCompare(b.data||'') || (a.id||0)-(b.id||0));
  const doCenario = jogos.filter(j=>{
    const cCasa = (j.gols||[]).filter(g=>g.time==='casa' && g.min<=minuto).length;
    const cVis  = (j.gols||[]).filter(g=>g.time==='vis'  && g.min<=minuto).length;
    return cCasa===pCasa && cVis===pVis;
  });
  if(!doCenario.length) return { jogos:0, confirmou:0, pct:null, serie:[] };
  const confirmouJogo = linha==='btts'
    ? (j)=> (j.gC||0)>0 && (j.gV||0)>0
    : (j)=> ((j.gC||0)+(j.gV||0))>linha;
  // série real: taxa de confirmação acumulada, jogo a jogo, em ordem cronológica —
  // mostra como o percentual foi se firmando conforme mais jogos entraram na amostra.
  let acumHits = 0;
  const evolucao = doCenario.map((j, idx)=>{
    if(confirmouJogo(j)) acumHits++;
    return Math.round((acumHits/(idx+1))*100);
  });
  const N_SERIE = 12;
  const confirmou = acumHits;
  return { jogos: doCenario.length, confirmou, pct: Math.round((confirmou/doCenario.length)*100), serie: evolucao.slice(-N_SERIE) };
}
window.cenarioLiga = cenarioLiga;

const clamp01 = (v)=> Math.max(0, Math.min(1, v));
const sub5 = (v)=> Math.round(clamp01(v)*5*10)/10; // sub-métrica vale até 5 pts (1 casa decimal)

// Os 4 critérios "por time" (Força / Ataque / Momento / Comportamento) — cada
// um vale 20, feito de 4 sub-métricas de 5 pts. Se faltar algum dado avançado
// (chutes, escanteios, cartões...) a sub-métrica vira neutra (2.5) em vez de
// zerar a categoria inteira só por falta de preenchimento opcional.
function categoriasPorTime(s){
  if(!s) return null;
  const forca = sub5(s.avgRank!=null ? (21-s.avgRank)/20 : 0.5)
              + sub5(s.vitorias/s.jogos)
              + sub5((s.empates/s.jogos)*2)
              + sub5(1-(s.derrotas/s.jogos));
  const ataque = sub5(s.avgMarcados/2.5)
               + (s.avgChutes!=null ? sub5(s.avgChutes/15) : 2.5)
               + (s.avgChutesGol!=null ? sub5(s.avgChutesGol/6) : 2.5)
               + (s.avgEscanteios!=null ? sub5(s.avgEscanteios/7) : 2.5);
  const momento = sub5(1-(s.avgSofridos/2.5))
                + (s.avgChutesGolSofridos!=null ? sub5(1-s.avgChutesGolSofridos/6) : 2.5)
                + (s.pctVenceHT!=null ? sub5(s.pctVenceHT/100) : 2.5)
                + (s.avgCartoes!=null ? sub5(1-s.avgCartoes/5) : 2.5);
  const comportamento = (s.avgMinPrimeiroGol!=null ? sub5(1-s.avgMinPrimeiroGol/90) : 2.5)
                      + sub5(s.pctMarca1T/100)
                      + sub5(s.pctMarca2T/100)
                      + sub5(1-s.pctSofre2T/100);
  return {
    forca: Math.round(forca*10)/10,
    ataque: Math.round(ataque*10)/10,
    momento: Math.round(momento*10)/10,
    comportamento: Math.round(comportamento*10)/10,
  };
}

function classificacaoScore(score){
  if(score>=81) return 'Excelente oportunidade';
  if(score>=61) return 'Cenário favorável';
  if(score>=41) return 'Cenário neutro';
  if(score>=21) return 'Cenário fraco para este mercado';
  return 'Cenário muito fraco para este mercado';
}

// filtros: { camp, limite, linha (linha do Over, ex 1.5), mandante, visitante,
//            cenarios:[{placar,minuto},{placar,minuto},{placar,minuto}] }
// Retorna tudo que a aba Equipes precisa: score final, os 5 critérios, a
// tendência de mercado da liga, os 3 cenários calculados e o comparativo.
function computeScoreEstrategia(filtros){
  filtros = filtros || {};
  const { camp, limite, linha=1.5, mandante, visitante, cenarios=[], modoMandante='ambas', modoVisitante='ambas' } = filtros;

  const statsM = mandante ? statsTimeRecente(mandante, camp, limite, linha, modoMandante) : null;
  const statsV = visitante ? statsTimeRecente(visitante, camp, limite, linha, modoVisitante) : null;
  const catM = categoriasPorTime(statsM);
  const catV = categoriasPorTime(statsV);
  const media2 = (a,b)=> a!=null && b!=null ? (a+b)/2 : (a!=null ? a : (b!=null ? b : 2.5));

  const tendencia = tendenciaMercadoLiga(camp, limite, linha);
  const cenariosCalc = cenarios.map(c=> ({ ...c, ...cenarioLiga(camp, limite, c.placar, c.minuto, linha) }));
  const pctCenariosMedia = (()=>{ const vals=cenariosCalc.map(c=>c.pct).filter(v=>v!=null); return vals.length? vals.reduce((a,b)=>a+b,0)/vals.length : null; })();

  const tendenciaScore = Math.round(((
      sub5(tendencia.pctConfirmacao!=null ? tendencia.pctConfirmacao/100 : 0.5)
    + sub5(tendencia.mediaPrimeiroGol!=null ? 1-tendencia.mediaPrimeiroGol/45 : 0.5)
    + sub5(tendencia.mediaConfirmacao!=null ? 1-tendencia.mediaConfirmacao/90 : 0.5)
    + sub5(pctCenariosMedia!=null ? pctCenariosMedia/100 : 0.5)
  ))*10)/10;

  const criterios = {
    forca: Math.round(media2(catM?.forca, catV?.forca)*10)/10,
    ataque: Math.round(media2(catM?.ataque, catV?.ataque)*10)/10,
    momento: Math.round(media2(catM?.momento, catV?.momento)*10)/10,
    comportamento: Math.round(media2(catM?.comportamento, catV?.comportamento)*10)/10,
    tendencia: tendenciaScore,
  };
  const total = Math.round(criterios.forca + criterios.ataque + criterios.momento + criterios.comportamento + criterios.tendencia);

  return {
    score: total,
    classificacao: classificacaoScore(total),
    criterios,
    tendencia: { ...tendencia, linha },
    cenarios: cenariosCalc,
    comparativo: { mandante: statsM, visitante: statsV },
  };
}
window.computeScoreEstrategia = computeScoreEstrategia;
