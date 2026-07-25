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
      // token inválido/expirado: volta pra tela de login, sem tentar carregar nada
      // (evita o erro "Erro ao carregar" aparecendo em cima da tela de login)
      authClearSessao();
    } else {
      // sessão válida: agora sim pode buscar os dados (RLS libera pra quem está logado)
      await carregarJogos();
      await bpCarregarNuvem();
      await cfgAppCarregarNuvem();
    }
  }
  // Sem sessão nenhuma (visita nova, ou acabou de confirmar e-mail e voltou pro
  // login): não tenta carregar jogos/banca — vai direto pra tela de login, limpa,
  // sem toast de erro. Os dados são carregados no login, via authIniciarSessao().
  authAplicarTela();
})();
