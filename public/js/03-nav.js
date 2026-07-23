// ═══════════════════════════════════════════════════
// NAVEGAÇÃO — menu lateral, troca de abas e sub-abas
// ═══════════════════════════════════════════════════
// ══ NAV ══
function toggleSidebar(force){
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  const abrir = force!==undefined ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', abrir);
  ov.classList.toggle('open', abrir);
}

function goTo(p) {
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.getElementById('tab-'+p).classList.add('active');
  toggleSidebar(false);
  window.scrollTo({top:0, behavior:'instant'});
  // Barra de navegação rápida (embaixo): acende o botão correspondente, se existir
  document.querySelectorAll('.quicknav-btn').forEach(x=>x.classList.remove('active'));
  document.getElementById('qnav-'+p)?.classList.add('active');
  if (p==='geral')       { renderGeral(); ophRenderLista(); }
  if (p==='dados')       { popularFiltroRodada(); renderDados(); }
  if (p==='analise')     { window.analiseReactRefresh?.(); renderAnalise(); }
  if (p==='calculadora') { /* Calculadora de EV agora é componente React (src/main.jsx), auto-inicializa */ }
  if (p==='apostas')     { bpCarregarNuvem().then(()=>{ goSubApostas('nova-entrada'); window.resolvidasRefresh?.(); calcEntrada(); }); }
  if (p==='banca')       { bpCarregarNuvem().then(()=>window.bancaRefresh?.()); }
  if (p==='futebol')     { window.estatisticaRefresh?.(); }
  if (p==='classificacao') { window.classificacaoRefresh?.(); }
  if (p==='confrontos')  { goSubConfrontos('add-partida'); }
  if (p==='minhaconta')  { window.perfilRefresh?.(); }
  if (p==='administracao') { window.administracaoRefresh?.(); }
}
// "Início" na navegação rápida: sempre volta pra tela inicial do Dashboard
// (grade de campeonatos + Jogos de Hoje), mesmo se o usuário estiver com um
// campeonato aberto — por isso zera o filtro de campeonato antes de renderizar.
function irParaInicio() {
  window.campGeral = '';
  window.timeGeral = '';
  goTo('geral');
}
function goSubConfrontos(t) {
  document.querySelectorAll('#page-confrontos .sub-tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('#page-confrontos .sub-page').forEach(x=>x.classList.remove('active'));
  document.getElementById('stab-'+t).classList.add('active');
  document.getElementById('sp-'+t).classList.add('active');
  if(t==='add-partida') { syncNomes(); renderCampo(); renderGolsLista(); sugCamp(); onCampInput(); }
  /* t==='sinal' — Novo Sinal de Entrada agora é componente React (src/main.jsx), auto-inicializa */
}
function goSubApostas(t) {
  document.querySelectorAll('#page-apostas .sub-tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('#page-apostas .sub-page').forEach(x=>x.classList.remove('active'));
  document.getElementById('stab-'+t).classList.add('active');
  document.getElementById('sp-'+t).classList.add('active');
  if(t==='nova-entrada') {
    const eDataEl=document.getElementById('eDataEntrada');
    if(eDataEl && !eDataEl.value) eDataEl.value=new Date().toISOString().split('T')[0];
    const cse=document.getElementById('campSugEntrada');
    if(cse) cse.innerHTML = sortNatural([...new Set(jogosCache.map(j=>j.camp))]).map(c=>`<option value="${c}">`).join('');
    atualizarResumoEntrada();
  }
  if(t==='resolvidas') window.resolvidasRefresh?.();
}
function goSubTab(t) {
  document.querySelectorAll('.sub-tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.sub-page').forEach(x=>x.classList.remove('active'));
  document.getElementById('stab-'+t).classList.add('active');
  document.getElementById('sp-'+t).classList.add('active');
}

