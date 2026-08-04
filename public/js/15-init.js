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
  if(iDataEl) iDataEl.value=hojeBR(); // corrigido pro fuso de Brasília (ver 04-utils.js)

  const sessao = authGetSessao();
  if(sessao && sessao.access_token){
    perfilAtual = await authBuscarPerfil();
    if(!perfilAtual){
      // token inválido/expirado: volta pra tela de login, sem tentar carregar nada
      // (evita o erro "Erro ao carregar" aparecendo em cima da tela de login)
      authClearSessao();
    } else {
      // sessão válida: agora sim pode buscar os dados (RLS libera pra quem está logado).
      //
      // CAUSA DA DEMORA (investigado): ao reabrir o app com uma sessão já salva (sem precisar
      // logar de novo), essas chamadas rodavam uma atrás da outra — cada fetch esperando o
      // anterior terminar — e só depois de todas a tela deixava de ficar em branco. Em conexão
      // lenta isso empilhava o tempo de espera (4 viagens de rede em vez de 1), exatamente como
      // acontecia em authIniciarSessao() (fluxo de login, já corrigido). Mesma correção aqui:
      // rodar em paralelo com Promise.all. Também estava faltando escudosCarregarNuvem() aqui,
      // que o login já carrega — sem ela, reabrir o app não sincronizava os escudos.
      await Promise.all([
        carregarJogos(),
        bpCarregarNuvem(),
        cfgAppCarregarNuvem(),
        escudosCarregarNuvem(),
      ]);
    }
  }
  // Sem sessão nenhuma (visita nova, ou acabou de confirmar e-mail e voltou pro
  // login): não tenta carregar jogos/banca — vai direto pra tela de login, limpa,
  // sem toast de erro. Os dados são carregados no login, via authIniciarSessao().
  authAplicarTela();
})();
