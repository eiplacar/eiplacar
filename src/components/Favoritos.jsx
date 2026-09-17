import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { SecaoFavoritados } from './AnaliseResultado.jsx';

// ══ Página "Favoritos" — menu lateral, logo abaixo de "Análise" ══
//
// Não duplica lógica nenhuma: reaproveita o mesmo componente <SecaoFavoritados />
// já usado dentro da aba Análise (sub-aba Índice) — mesma lista, mesmos dados
// (window.favIndiceAtivos() / window.removerFavoritoIndice()), só que agora
// também como uma página própria, acessível direto pelo menu.
//
// window.favIndiceRefresh já é usado por AnaliseResultado.jsx pra se re-renderizar
// quando um favorito é adicionado/removido em qualquer lugar do app. Como as duas
// páginas ficam montadas ao mesmo tempo (troca de aba é só CSS, ver 03-nav.js),
// esse hook ENCADEIA no que já existir ali, em vez de sobrescrever — assim as
// duas continuam atualizando juntas, não importa a ordem de montagem.
export default function Favoritos() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const anterior = window.favIndiceRefresh;
    const encadeada = () => { setTick((t) => t + 1); anterior?.(); };
    window.favIndiceRefresh = encadeada;
    return () => { if (window.favIndiceRefresh === encadeada) window.favIndiceRefresh = anterior; };
  }, []);

  return (
    <div>
      <div className="sec-title" style={{ marginBottom: 4 }}><Star size={14} style={{ marginRight: 4 }} />Confrontos Favoritados</div>
      <p style={{ fontSize: 12, color: 'var(--texto2)', marginTop: -2, marginBottom: 12 }}>Confrontos que você favoritou na aba Análise (sub-aba Índice) ficam salvos aqui.</p>
      <SecaoFavoritados />
    </div>
  );
}
