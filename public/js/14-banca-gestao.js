// ═══════════════════════════════════════════════════
// ABA BANCA (carteira individual) — resumo, depósitos/retiradas/transferências, evolução
// ═══════════════════════════════════════════════════

// ══ CARTEIRA — resumo (usado pela sub-aba "Carteira" do componente React Banca.jsx) ══
function computeCarteira(){
  const d = bpLoad();
  const depositos = (d.movimentos||[]).filter(m=>m.tipo==='deposito').reduce((s,m)=>s+m.valor,0);
  const retiradas = (d.movimentos||[]).filter(m=>m.tipo==='retirada').reduce((s,m)=>s+m.valor,0);
  const greens = d.entradas.filter(e=>e.resultado==='green').length;
  const reds   = d.entradas.filter(e=>e.resultado==='red').length;
  const validas = greens+reds;
  const taxaAcerto = validas ? Math.round((greens/validas)*100) : 0;
  const lucroTotal = d.entradas.filter(e=>e.resultado==='green').reduce((s,e)=>s+(e.lucro||0),0);
  const prejTotal  = d.entradas.filter(e=>e.resultado==='red').reduce((s,e)=>s+(e.stake||0),0);
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
  const dataMov = data || new Date().toISOString().split('T')[0];

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

// ══ EVOLUÇÃO — série histórica de saldo/reserva + métricas (melhor sequência, maior drawdown, crescimento mensal) ══
function computeEvolucao(){
  const d = bpLoad();
  // Reconstrói a linha do tempo em ordem cronológica: entradas (mais recente primeiro no array, então inverte) + movimentos
  const eventos = [
    ...d.entradas.map(e=>({ data:e.data, ts:e.id||0, tipo:'entrada', e })),
    ...(d.movimentos||[]).map(m=>({ data:m.data, ts:m.id||0, tipo:'movimento', m })),
  ].sort((a,b)=> (a.data||'').localeCompare(b.data||'') || a.ts-b.ts);

  let saldo=0, reserva=0;
  const pontosSaldo=[0], pontosReserva=[0], datas=[null];
  const protecaoAtiva = d.protecaoAtiva!==false, protecaoPct = d.protecaoPct??10;

  let seqAtual=0, melhorSeq=0;
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
      if(e.resultado==='green'){
        const corte = protecaoAtiva ? Math.round((e.lucro||0)*protecaoPct/100*100)/100 : 0;
        saldo += (e.lucro||0)-corte;
        reserva += corte;
        seqAtual = seqAtual>=0 ? seqAtual+1 : 1;
        const mesKey = (e.data||'').slice(0,7);
        if(mesKey) porMes[mesKey] = (porMes[mesKey]||0) + ((e.lucro||0)-corte);
      } else if(e.resultado==='red'){
        saldo -= (e.stake||0);
        seqAtual = seqAtual<=0 ? seqAtual-1 : -1;
        const mesKey = (e.data||'').slice(0,7);
        if(mesKey) porMes[mesKey] = (porMes[mesKey]||0) - (e.stake||0);
      }
      melhorSeq = Math.max(melhorSeq, seqAtual);
    }
    saldo = Math.round(saldo*100)/100; reserva = Math.round(reserva*100)/100;
    pontosSaldo.push(saldo); pontosReserva.push(reserva); datas.push(ev.data||null);
    pico = Math.max(pico, saldo);
    maiorDrawdown = Math.min(maiorDrawdown, saldo-pico);
  });

  const crescimentoMensal = Object.entries(porMes).sort((a,b)=>a[0].localeCompare(b[0])).map(([mes,pl])=>({ mes, pl:Math.round(pl*100)/100 }));

  return { pontosSaldo, pontosReserva, datas, melhorSequencia:melhorSeq, maiorDrawdown:Math.round(maiorDrawdown*100)/100, crescimentoMensal };
}
window.computeEvolucao = computeEvolucao;


function sugCamp(){
  const camps=sortNatural([...new Set(jogosCache.map(j=>j.camp))]);
  document.getElementById('campSug').innerHTML=camps.map(c=>`<option value="${c}">`).join('');
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
  // Sugerir rodadas do campeonato
  const rodadas=[...new Set(jogosDoCamp.map(j=>j.rodada).filter(Boolean))].sort();
  document.getElementById('rodadasSug').innerHTML=rodadas.map(r=>`<option value="${r}">`).join('');
  verificarDuplicado();
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

