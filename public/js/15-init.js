// ═══════════════════════════════════════════════════
// INICIALIZAÇÃO — roda ao carregar a página, decide entre tela de login ou app
// ═══════════════════════════════════════════════════
// ══ INIT ══
(async function(){
  // iData agora é campo do componente React (AdicionarPartida.jsx), que só monta
  // DEPOIS deste script (scripts type="module" rodam por último). Ele mesmo cuida
  // do próprio valor padrão — aqui só protegemos pra não travar a inicialização
  // caso o componente ainda não tenha montado.
  const iDataEl = document.getElementById('iData');
  if(iDataEl) iDataEl.value=new Date().toISOString().split('T')[0];

  const sessao = authGetSessao();
  if(sessao && sessao.access_token){
    perfilAtual = await authBuscarPerfil();
    if(!perfilAtual){
      // token inválido/expirado: volta pra tela de login
      authClearSessao();
    }
  }

  await carregarJogos();
  await bpCarregarNuvem();
  await cfgAppCarregarNuvem();
  authAplicarTela();
})();
