// ═══════════════════════════════════════════════════
// ABA DADOS — "Lista de Partidas" migrada para React (src/components/ListaPartidas.jsx)
// ═══════════════════════════════════════════════════
// Estas duas funções continuam existindo com o mesmo nome de sempre porque várias
// partes do app ainda JS puro chamam elas (navegação, salvar/editar/excluir jogo,
// importar planilha, etc.). Agora elas só servem de "sininho": sincronizam
// window.jogosCache com o valor mais atual e avisam os componentes React que dependem
// dele (Lista de Partidas E o seletor da Análise) pra redesenhar.
function renderDados(resetPagina) {
  window.jogosCache = jogosCache; // ponte: garante que o React sempre veja os dados mais recentes
  if (resetPagina) window.dadosResetPagina?.();
  window.dadosReactRefresh?.();
  window.analiseReactRefresh?.();
}
function popularFiltroRodada() {
  window.jogosCache = jogosCache;
  window.dadosReactRefresh?.();
  window.analiseReactRefresh?.();
}
