// ═══════════════════════════════════════════════════
// ABA BANCA (carteira individual) — resumo, depósitos/retiradas/transferências, evolução
// ═══════════════════════════════════════════════════

// ══ CARTEIRA — resumo (usado pela sub-aba "Carteira" do componente React Banca.jsx) ══
function computeCarteira(){
  const d = bpLoad();
  const depositos = (d.movimentos||[]).filter(m=>m.tipo==='deposito').reduce((s,m)=>s+m.valor,0);
  const retiradas = (d.movimentos||[]).filter(m=>m.tipo==='retirada').reduce((s,m)=>s+m.valor,0);
  const greens = d.entradas.filter(e=>contaComoGreenEntrada(e)).length;
  const reds   = d.entradas.filter(e=>e.resultado==='red').length;
  const validas = greens+reds;
  const taxaAcerto = validas ? Math.round((greens/validas)*100) : 0;
  const lucroTotal = d.entradas.filter(e=>contaComoGreenEntrada(e)).reduce((s,e)=>s+(e.lucro||0),0);
  const prejTotal  = d.entradas.filter(e=>e.resultado==='red').reduce((s,e)=>s+valorPerdaEntrada(e),0);
  const pl = Math.round((lucroTotal-prejTotal)*100)/100;
  const capitalInicial = Math.round((depositos-retiradas)*100)/100;
  const roi = capitalInicial>0 ? Math.round((pl/capitalInicial)*1000)/10 : 0;
  const saldo = Math.round((d.saldo||0)*100)/100;
  const reserva = Math.round((d.reserva||0)*100)/100;
  const stakeRecomendada = [1,2,3].map(pct=>({ pct, valor: Math.round(saldo*pct/100*100)/100 }));
  return {
    saldo, reserva, depositos: Math.round(depositos*100)/100, retiradas: Math.round(retiradas*100)/100,
    pl, roi, taxaAcerto, entradas: d.entradas.length, greens, reds, stakeRecomendada,
    protecaoAtiva: d.protecaoAtiva!==false, protecaoPct: d.protecaoPct??10,
  };
}
window.computeCarteira = computeCarteira;

// ══ MOVIMENTAÇÕES — Depositar / Retirar / Carteira→Reserva / Reserva→Carteira ══
// Ação única pras 4 operações do mockup. Retorna {ok:true} ou {ok:false, msg} — quem
// chama (Banca.jsx) decide como mostrar o erro (não usa toast aqui pra ficar mais fácil
// de testar/reaproveitar).
function bancaMovimentar(tipo, valor, data, obs){
  valor = Math.round((parseFloat(valor)||0)*100)/100;
  if(valor<=0) return { ok:false, msg:'Informe um valor válido' };
  const d = bpLoad();
  const dataMov = data || hojeBR(); // corrigido pro fuso de Brasília (ver 04-utils.js)

  if(tipo==='deposito'){
    d.saldo = Math.round(((d.saldo||0)+valor)*100)/100;
  } else if(tipo==='retirada'){
    if(valor > (d.saldo||0)+0.001) return { ok:false, msg:`Saldo da carteira: R$ ${(d.saldo||0).toFixed(2)}` };
    d.saldo = Math.round(((d.saldo||0)-valor)*100)/100;
  } else if(tipo==='carteira_reserva'){
    if(valor > (d.saldo||0)+0.001) return { ok:false, msg:`Saldo da carteira: R$ ${(d.saldo||0).toFixed(2)}` };
    d.saldo    = Math.round(((d.saldo||0)-valor)*100)/100;
    d.reserva  = Math.round(((d.reserva||0)+valor)*100)/100;
  } else if(tipo==='reserva_carteira'){
    if(valor > (d.reserva||0)+0.001) return { ok:false, msg:`Saldo da reserva: R$ ${(d.reserva||0).toFixed(2)}` };
    d.reserva  = Math.round(((d.reserva||0)-valor)*100)/100;
    d.saldo    = Math.round(((d.saldo||0)+valor)*100)/100;
  } else {
    return { ok:false, msg:'Operação inválida' };
  }

  if(!d.movimentos) d.movimentos=[];
  d.movimentos.unshift({ id:Date.now(), tipo, valor, data:dataMov, obs:(obs||'').trim() });
  bpSave(d);
  return { ok:true };
}
window.bancaMovimentar = bancaMovimentar;

function bancaExcluirMovimento(id){
  const d = bpLoad();
  const mov = (d.movimentos||[]).find(m=>m.id===id);
  if(!mov) return { ok:false };
  // Reverte o efeito exatamente ao contrário do que foi aplicado
  if(mov.tipo==='deposito')          d.saldo   = Math.round(((d.saldo||0)-mov.valor)*100)/100;
  else if(mov.tipo==='retirada')     d.saldo   = Math.round(((d.saldo||0)+mov.valor)*100)/100;
  else if(mov.tipo==='carteira_reserva'){ d.saldo = Math.round(((d.saldo||0)+mov.valor)*100)/100; d.reserva = Math.round(((d.reserva||0)-mov.valor)*100)/100; }
  else if(mov.tipo==='reserva_carteira'){ d.reserva = Math.round(((d.reserva||0)+mov.valor)*100)/100; d.saldo = Math.round(((d.saldo||0)-mov.valor)*100)/100; }
  d.movimentos = d.movimentos.filter(m=>m.id!==id);
  bpSave(d);
  return { ok:true };
}
window.bancaExcluirMovimento = bancaExcluirMovimento;

// ══ PROTEÇÃO DA BANCA — configuração (aba Minha Conta → Configurações) ══
function bancaSalvarProtecao(ativa, pct){
  const d = bpLoad();
  d.protecaoAtiva = !!ativa;
  d.protecaoPct = Math.round(parseFloat(pct))||10;
  bpSave(d);
}
window.bancaSalvarProtecao = bancaSalvarProtecao;

// ══ STOP E META — configuração (aba Minha Conta → Configurações, ao lado da Proteção) ══
function bancaSalvarStopMeta(meta, stopGain, stopLoss){
  const d = bpLoad();
  d.metaDiaria = Math.max(0, Math.round((parseFloat(meta)||0)*100)/100);
  d.stopGain = Math.max(0, Math.round((parseFloat(stopGain)||0)*100)/100);
  d.stopLoss = Math.max(0, Math.round((parseFloat(stopLoss)||0)*100)/100);
  bpSave(d);
}
window.bancaSalvarStopMeta = bancaSalvarStopMeta;

// ══ RESUMOS — Meta Diária, Controle de Stop, Resumo do Dia/Mês, Recordes ══
// (usado pela sub-aba "Evolução" do componente React Banca.jsx)
function computeResumoBanca(){
  const d = bpLoad();
  const hoje = hojeBR(); // corrigido pro fuso de Brasília — reset de Meta/Stop batia 3h cedo (ver 04-utils.js)
  const mesAtual = hoje.slice(0,7);

  const depositos = (d.movimentos||[]).filter(m=>m.tipo==='deposito').reduce((s,m)=>s+m.valor,0);
  const retiradas = (d.movimentos||[]).filter(m=>m.tipo==='retirada').reduce((s,m)=>s+m.valor,0);
  const capitalInicial = Math.round((depositos-retiradas)*100)/100;

  // P&L por dia (só entradas resolvidas contam) — usado no resumo de hoje, do mês e nos recordes
  const porDia = {};
  d.entradas.forEach(e=>{
    if(!e.data) return;
    if(e.resultado==='green') porDia[e.data] = (porDia[e.data]||0) + (e.lucro||0);
    else if(e.resultado==='red') porDia[e.data] = (porDia[e.data]||0) - valorPerdaEntrada(e);
    else if(e.resultado==='cashout') porDia[e.data] = (porDia[e.data]||0) + (e.lucro||0); // entrada antiga (ver comentário do helper em 04-utils.js)
  });

  let maiorLucroDia = null, maiorPrejuizoDia = null;
  Object.entries(porDia).forEach(([data, valorBruto])=>{
    const valor = Math.round(valorBruto*100)/100;
    if(valor>0 && (!maiorLucroDia || valor>maiorLucroDia.valor)) maiorLucroDia = { data, valor };
    if(valor<0 && (!maiorPrejuizoDia || valor<maiorPrejuizoDia.valor)) maiorPrejuizoDia = { data, valor };
  });

  const entradasHoje = d.entradas.filter(e=>e.data===hoje && e.resultado);
  const greensHoje = entradasHoje.filter(e=>contaComoGreenEntrada(e)).length;
  const redsHoje = entradasHoje.filter(e=>e.resultado==='red').length;
  const validasHoje = greensHoje+redsHoje;
  const taxaAcertoHoje = validasHoje ? Math.round((greensHoje/validasHoje)*100) : 0;
  const plHoje = Math.round((porDia[hoje]||0)*100)/100;

  const entradasMes = d.entradas.filter(e=>(e.data||'').slice(0,7)===mesAtual && e.resultado);
  const greensMes = entradasMes.filter(e=>contaComoGreenEntrada(e)).length;
  const redsMes = entradasMes.filter(e=>e.resultado==='red').length;
  const validasMes = greensMes+redsMes;
  const taxaAcertoMes = validasMes ? Math.round((greensMes/validasMes)*100) : 0;
  const plMes = Math.round(Object.entries(porDia).filter(([data])=>data.slice(0,7)===mesAtual).reduce((s,[,v])=>s+v,0)*100)/100;
  const roiMes = capitalInicial>0 ? Math.round((plMes/capitalInicial)*1000)/10 : 0;

  const metaDiaria = d.metaDiaria||0;
  const stopGain = d.stopGain||0;
  const stopLoss = d.stopLoss||0;

  const progressoMeta = metaDiaria>0 ? Math.max(0, Math.min(100, Math.round((plHoje/metaDiaria)*100))) : 0;
  const metaBatida = metaDiaria>0 && plHoje>=metaDiaria;
  const faltaMeta = Math.max(0, Math.round((metaDiaria-plHoje)*100)/100);

  const progressoStopGain = stopGain>0 ? Math.max(0, Math.min(100, Math.round((plHoje/stopGain)*100))) : 0;
  const stopGainAtingido = stopGain>0 && plHoje>=stopGain;
  const faltaStopGain = Math.max(0, Math.round((stopGain-plHoje)*100)/100);

  const progressoStopLoss = stopLoss>0 ? Math.max(0, Math.min(100, Math.round((Math.abs(Math.min(0,plHoje))/stopLoss)*100))) : 0;
  const stopLossAtingido = stopLoss>0 && plHoje<=-stopLoss;
  const faltaStopLoss = Math.max(0, Math.round((stopLoss-Math.abs(Math.min(0,plHoje)))*100)/100);

  return {
    metaDiaria, stopGain, stopLoss,
    progressoMeta, metaBatida, faltaMeta,
    progressoStopGain, stopGainAtingido, faltaStopGain,
    progressoStopLoss, stopLossAtingido, faltaStopLoss,
    plHoje, entradasHoje: entradasHoje.length, greensHoje, redsHoje, taxaAcertoHoje,
    plMes, entradasMes: entradasMes.length, greensMes, redsMes, taxaAcertoMes, roiMes,
    maiorLucroDia, maiorPrejuizoDia,
  };
}
window.computeResumoBanca = computeResumoBanca;

// ══ EVOLUÇÃO — série histórica de saldo/reserva + métricas (melhor sequência, maior drawdown, crescimento mensal) ══
function computeEvolucao(){
  const d = bpLoad();
  // Reconstrói a linha do tempo em ordem cronológica: entradas (mais recente primeiro no array, então inverte) + movimentos
  const eventos = [
    ...d.entradas.map(e=>({ data:e.data, ts:e.id||0, tipo:'entrada', e })),
    ...(d.movimentos||[]).map(m=>({ data:m.data, ts:m.id||0, tipo:'movimento', m })),
  ].sort((a,b)=> (a.data||'').localeCompare(b.data||'') || a.ts-b.ts);

  let saldo=0, reserva=0;
  const pontosSaldo=[], pontosReserva=[], datas=[];
  const protecaoAtiva = d.protecaoAtiva!==false, protecaoPct = d.protecaoPct??10;

  let seqAtual=0, melhorSeq=0, piorSeq=0;
  let pico=0, maiorDrawdown=0;
  const porMes = {}; // 'AAAA-MM' -> pl do mês

  eventos.forEach(ev=>{
    if(ev.tipo==='movimento'){
      const m = ev.m;
      if(m.tipo==='deposito') saldo += m.valor;
      else if(m.tipo==='retirada') saldo -= m.valor;
      else if(m.tipo==='carteira_reserva'){ saldo -= m.valor; reserva += m.valor; }
      else if(m.tipo==='reserva_carteira'){ reserva -= m.valor; saldo += m.valor; }
    } else {
      const e = ev.e;
      if(contaComoGreenEntrada(e)){
        const corte = protecaoAtiva ? Math.round((e.lucro||0)*protecaoPct/100*100)/100 : 0;
        saldo += (e.lucro||0)-corte;
        reserva += corte;
        seqAtual = seqAtual>=0 ? seqAtual+1 : 1;
        const mesKey = (e.data||'').slice(0,7);
        if(mesKey) porMes[mesKey] = (porMes[mesKey]||0) + ((e.lucro||0)-corte);
      } else if(e.resultado==='red'){
        const perda = valorPerdaEntrada(e);
        saldo -= perda;
        seqAtual = seqAtual<=0 ? seqAtual-1 : -1;
        const mesKey = (e.data||'').slice(0,7);
        if(mesKey) porMes[mesKey] = (porMes[mesKey]||0) - perda;
      }
      melhorSeq = Math.max(melhorSeq, seqAtual);
      piorSeq = Math.min(piorSeq, seqAtual);
    }
    saldo = Math.round(saldo*100)/100; reserva = Math.round(reserva*100)/100;
    pontosSaldo.push(saldo); pontosReserva.push(reserva); datas.push(ev.data||null);
    pico = Math.max(pico, saldo);
    maiorDrawdown = Math.min(maiorDrawdown, saldo-pico);
  });

  const crescimentoMensal = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0])).map(([mes,pl])=>({ mes, pl:Math.round(pl*100)/100 }));

  // Sem nenhuma entrada/movimento ainda (banca zerada / conta nova): os arrays
  // ficam vazios e quebravam o gráfico de Evolução (pontosSaldo[0] undefined
  // → undefined.toFixed() explode a tela toda). Garante sempre 1 ponto inicial.
  if(pontosSaldo.length===0){ pontosSaldo.push(0); pontosReserva.push(0); datas.push(null); }

  return { pontosSaldo, pontosReserva, datas, melhorSequencia:melhorSeq, piorSequencia:Math.abs(piorSeq), maiorDrawdown:Math.round(maiorDrawdown*100)/100, crescimentoMensal };
}
window.computeEvolucao = computeEvolucao;


function sugCamp(){
  const camps=sortNatural([...new Set(jogosCache.map(j=>j.camp))]);
  document.getElementById('campSug').innerHTML=camps.map(c=>`<option value="${c}">`).join('');
  const paisSugEl=document.getElementById('paisSug');
  if(paisSugEl){
    const paises=sortNatural([...new Set(jogosCache.map(j=>j.pais).filter(Boolean))]);
    paisSugEl.innerHTML=paises.map(p=>`<option value="${p}">`).join('');
  }
}

function onCampInput(){
  const camp=document.getElementById('iCamp').value.trim();
  // Sugerir times do campeonato
  const jogosDoCamp=camp?jogosCache.filter(j=>j.camp===camp):jogosCache;
  const times=[...new Set([...jogosDoCamp.map(j=>j.casa),...jogosDoCamp.map(j=>j.vis)])].sort();
  document.getElementById('timesSug').innerHTML=times.map(t=>`<option value="${t}">`).join('');
  // Sugerir estádios do campeonato
  const locais=[...new Set(jogosDoCamp.map(j=>j.local).filter(Boolean))].sort();
  document.getElementById('localSug').innerHTML=locais.map(l=>`<option value="${l}">`).join('');
  // Sugerir rodadas do campeonato — pra Champions League, junta as rodadas já usadas
  // com as etapas fixas de Qualificação/Playoffs (mata-mata, fora da Fase Liga por
  // pontos corridos — ver computeClassificacao em 12-banca-futebol.js).
  const rodadasUsadas=[...new Set(jogosDoCamp.map(j=>j.rodada).filter(Boolean))];
  const ETAPAS_CL = /champions league/i.test(camp) ? [
    'Qualificação - Oitavas de Final', 'Qualificação - Quartas de Final', 'Qualificação - Semifinais', 'Qualificação - Final',
    'Playoffs - 16 Avos de Final', 'Playoffs - Oitavas de Final', 'Playoffs - Quartas de Final', 'Playoffs - Semifinais', 'Playoffs - Final',
  ] : [];
  const rodadas=[...new Set([...rodadasUsadas, ...ETAPAS_CL])].sort();
  document.getElementById('rodadasSug').innerHTML=rodadas.map(r=>`<option value="${r}">`).join('');
  // Auto-preencher país: se esse campeonato já foi cadastrado antes com um país,
  // usa o mesmo — assim ninguém precisa redigitar (nem errar) o país toda vez.
  const iPaisEl=document.getElementById('iPais');
  if(iPaisEl && !iPaisEl.value){
    const jaCadastrado = jogosDoCamp.find(j=>j.pais);
    if(jaCadastrado) iPaisEl.value = jaCadastrado.pais;
  }
  verificarCampPaisDivergente();
  verificarDuplicado();
}

// Avisa se o campeonato digitado já existe no banco com um PAÍS DIFERENTE do que
// está no campo agora — isso pega o caso de duas ligas com o mesmo nome (ex: "Série A"
// do Brasil e "Série A" da Itália), que senão ficariam misturadas nas Estatísticas,
// já que o nome do campeonato é a chave usada em todo o app pra agrupar os jogos.
function verificarCampPaisDivergente(){
  const el = document.getElementById('alertaCampPaisDivergente');
  const txt = document.getElementById('alertaCampPaisDivergenteTexto');
  if(!el || !txt) return;
  const camp = document.getElementById('iCamp')?.value.trim();
  const pais = document.getElementById('iPais')?.value.trim();
  if(!camp || !pais){ el.style.display='none'; return; }
  const outroPais = jogosCache.find(j=>j.camp===camp && j.pais && j.pais!==pais);
  if(outroPais){
    txt.textContent = `Já existe "${camp}" cadastrado como ${outroPais.pais}. Se for outro campeonato (outro país), use um nome diferente pra não misturar os dois nas estatísticas — ex: "${camp} (${pais})".`;
    el.style.display='flex';
  } else {
    el.style.display='none';
  }
}

function onTimeInput(){
  const casa=document.getElementById('iCasa').value.trim();
  const vis=document.getElementById('iVis').value.trim();
  // Alerta mesmo time
  const alertaDup=document.getElementById('alertaDupTime');
  alertaDup.style.display=(casa&&vis&&casa===vis)?'flex':'none';
  verificarDuplicado();
}

function verificarDuplicado(){
  const camp=document.getElementById('iCamp').value.trim();
  const casa=document.getElementById('iCasa').value.trim();
  const vis=document.getElementById('iVis').value.trim();
  const data=document.getElementById('iData').value;
  const alertaJogo=document.getElementById('alertaDupJogo');
  if(camp&&casa&&vis&&data){
    const dup=jogosCache.find(j=>j.camp===camp&&j.casa===casa&&j.vis===vis&&j.data===data);
    alertaJogo.style.display=dup?'flex':'none';
  } else {
    alertaJogo.style.display='none';
  }
}
function atualizarHeader(){ /* card de jogos removido — a contagem fica nos cards da aba Geral */ }

function toggleMenuUsuario(){
  const m = document.getElementById('menuUsuario');
  m.style.display = m.style.display==='block' ? 'none' : 'block';
}
function fecharMenuUsuario(){
  const m = document.getElementById('menuUsuario');
  if(m) m.style.display='none';
}
document.addEventListener('click', e=>{
  if(!e.target.closest('#userAvatar') && !e.target.closest('#menuUsuario')) fecharMenuUsuario();
});

function sairConta(){
  fecharMenuUsuario();
  fazerLogout();
}
function renderAll(){ renderGeral(); popularFiltroRodada(); renderDados(); }

