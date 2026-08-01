import { useState, useEffect, Fragment } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

// ══ Seletor de Mercado (bottom sheet) ══
//
// Aberto ao clicar em "Bet" ou "Exchange" (Operação) na Nova Entrada, ou pelo botão
// "Escolher" ao lado do campo Mercado. Fluxo:
//   1) Categoria: Gols / Cartões / Escanteios / Resultado / Outros
//   2) (só Gols) Partida / 1º Tempo / 2º Tempo
//   3) Mercados da categoria (Mais de / Menos de, Ambas Marcam, Resultado, ou texto livre em Outros)
//   4) (só quando operacao === 'exchange') A Favor (Back) ou Contra (Lay)
//
// Ao finalizar, chama onSelecionar(textoDoMercado) — quem usa este componente decide
// o que fazer com o texto (aqui, escrever em #eMercado e chamar atualizarResumoEntrada()).

const CATEGORIAS = [
  { id: 'gols', label: 'Gols', icone: '⚽' },
  { id: 'cartoes', label: 'Cartões', icone: '🟨' },
  { id: 'escanteios', label: 'Escanteios', icone: '🚩' },
  { id: 'resultado', label: 'Resultado', icone: '🎯' },
  { id: 'outros', label: 'Outros', icone: '➕' },
];

const LINHAS = {
  gols: [0.5, 1.5, 2.5],
  cartoes: [2.5, 3.5, 4.5],
  escanteios: [7.5, 8.5, 9.5],
};

const TEMPOS_GOLS = [
  { id: 'partida', label: 'Partida' },
  { id: '1t', label: '1º Tempo' },
  { id: '2t', label: '2º Tempo' },
];

const NOME_UNIDADE = { gols: 'Gols', cartoes: 'Cartões', escanteios: 'Escanteios' };

export default function SeletorMercado({ aberto, operacao = 'bet', onFechar, onSelecionar }) {
  const [passo, setPasso] = useState('categoria'); // categoria | tempo | mercados | outros | backlay
  const [categoria, setCategoria] = useState(null);
  const [tempo, setTempo] = useState('partida');
  const [mercadoPendente, setMercadoPendente] = useState('');
  const [mandante, setMandante] = useState('');
  const [visitante, setVisitante] = useState('');

  // Reseta o fluxo toda vez que a folha é reaberta, e lê os times já escolhidos
  // no formulário (Mandante/Visitante) pra deixar os botões de Resultado com nome de time.
  useEffect(() => {
    if (!aberto) return;
    setPasso('categoria');
    setCategoria(null);
    setTempo('partida');
    setMercadoPendente('');
    setMandante(document.getElementById('eMandanteSel')?.value || '');
    setVisitante(document.getElementById('eVisitanteSel')?.value || '');
  }, [aberto]);

  if (!aberto) return null;

  function prefixoTempo() {
    if (categoria !== 'gols') return '';
    if (tempo === '1t') return '1º Tempo · ';
    if (tempo === '2t') return '2º Tempo · ';
    return '';
  }

  function finalizar(texto) {
    if (operacao === 'exchange') {
      setMercadoPendente(texto);
      setPasso('backlay');
      return;
    }
    onSelecionar(texto);
    onFechar();
  }

  function finalizarComBackLay(tipo) {
    const rotulo = tipo === 'back' ? 'Back (A Favor)' : 'Lay (Contra)';
    onSelecionar(`${rotulo}: ${mercadoPendente}`);
    onFechar();
  }

  function abrirCategoria(cat) {
    setCategoria(cat);
    setTempo('partida');
    if (cat === 'outros') { setPasso('outros'); return; }
    if (cat === 'gols') { setPasso('tempo'); return; }
    setPasso('mercados');
  }

  function voltar() {
    if (passo === 'tempo') { setPasso('categoria'); return; }
    if (passo === 'mercados') { setPasso(categoria === 'gols' ? 'tempo' : 'categoria'); return; }
    if (passo === 'outros') { setPasso('categoria'); return; }
    if (passo === 'backlay') { setPasso(categoria === 'gols' ? 'mercados' : (categoria === 'outros' ? 'outros' : 'mercados')); return; }
  }

  const labelMandante = mandante || 'Mandante';
  const labelVisitante = visitante || 'Visitante';

  const botoesResultado = [
    labelMandante,
    'Empate',
    labelVisitante,
    `${labelMandante} ou Empate`,
    `Empate ou ${labelVisitante}`,
    `${labelMandante} ou ${labelVisitante}`,
  ];

  const tituloCategoria = CATEGORIAS.find((c) => c.id === categoria)?.label || '';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'flex-end' }} onClick={onFechar}>
      <div style={{ background: 'var(--c2)', borderRadius: '16px 16px 0 0', width: '100%', maxHeight: '82vh', overflowY: 'auto', padding: 16 }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {passo !== 'categoria' && (
              <button type="button" onClick={voltar}
                style={{ flexShrink: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--texto2)', cursor: 'pointer' }}>
                <ChevronLeft size={16} />
              </button>
            )}
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {passo === 'categoria' && `Escolha o Mercado (${operacao === 'exchange' ? 'Exchange' : 'Bet'})`}
              {passo === 'tempo' && `${tituloCategoria} — Escolha o Período`}
              {passo === 'mercados' && (categoria === 'gols' ? `Gols — ${TEMPOS_GOLS.find((t) => t.id === tempo)?.label}` : tituloCategoria)}
              {passo === 'outros' && 'Mercado Personalizado'}
              {passo === 'backlay' && 'A Favor ou Contra?'}
            </div>
          </div>
          <button type="button" onClick={onFechar}
            style={{ flexShrink: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--texto2)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* PASSO 1: Categoria de Mercado */}
        {passo === 'categoria' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {CATEGORIAS.map((c) => (
              <button key={c.id} type="button" onClick={() => abrirCategoria(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px', borderRadius: 10, border: '1px solid var(--c3)', background: 'var(--c1)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <span style={{ fontSize: 18 }}>{c.icone}</span> {c.label}
              </button>
            ))}
          </div>
        )}

        {/* PASSO 2 (só Gols): Partida / 1º Tempo / 2º Tempo */}
        {passo === 'tempo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TEMPOS_GOLS.map((t) => (
              <button key={t.id} type="button" onClick={() => { setTempo(t.id); setPasso('mercados'); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 10, border: '1px solid var(--c3)', background: 'var(--c1)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {t.label} <ChevronRight size={15} color="var(--texto2)" />
              </button>
            ))}
          </div>
        )}

        {/* PASSO 3: Gols / Cartões / Escanteios — Mais de/Menos de (+ Ambas Marcam em Gols) + Outros */}
        {passo === 'mercados' && (categoria === 'gols' || categoria === 'cartoes' || categoria === 'escanteios') && (
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Mais de / Menos de</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {LINHAS[categoria].map((linha) => (
                <Fragment key={linha}>
                  <button type="button" onClick={() => finalizar(`${prefixoTempo()}Mais de ${linha} ${NOME_UNIDADE[categoria]}`)}
                    style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid var(--verde2)', background: 'rgba(37,163,82,.12)', color: 'var(--verde2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    Mais de {linha}
                  </button>
                  <button type="button" onClick={() => finalizar(`${prefixoTempo()}Menos de ${linha} ${NOME_UNIDADE[categoria]}`)}
                    style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e05555', background: 'rgba(224,85,85,.12)', color: '#e05555', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    Menos de {linha}
                  </button>
                </Fragment>
              ))}
            </div>

            {categoria === 'gols' && (
              <>
                <div style={{ fontSize: 10.5, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Ambas Marcam</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <button type="button" onClick={() => finalizar(`${prefixoTempo()}Ambas Marcam`)}
                    style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid var(--verde2)', background: 'rgba(37,163,82,.12)', color: 'var(--verde2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    Ambas Marcam
                  </button>
                  <button type="button" onClick={() => finalizar(`${prefixoTempo()}Não Marcam`)}
                    style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #e05555', background: 'rgba(224,85,85,.12)', color: '#e05555', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    Não Marcam
                  </button>
                </div>
              </>
            )}

            <div style={{ fontSize: 10.5, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Outros</div>
            <MercadoOutrosInline prefixo={prefixoTempo()} onConfirmar={finalizar} />
          </div>
        )}

        {/* PASSO 3b: Resultado */}
        {passo === 'mercados' && categoria === 'resultado' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {botoesResultado.map((texto) => (
              <button key={texto} type="button" onClick={() => finalizar(texto)}
                style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--c3)', background: 'var(--c1)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                {texto}
              </button>
            ))}
          </div>
        )}

        {/* PASSO 4: Outros (mercado personalizado, ex: jogador para marcar) */}
        {passo === 'outros' && <MercadoOutrosCompleto onConfirmar={finalizar} />}

        {/* PASSO 5 (só Exchange): A Favor (Back) ou Contra (Lay) */}
        {passo === 'backlay' && (
          <div>
            <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: 'var(--texto2)' }}>
              {mercadoPendente}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" onClick={() => finalizarComBackLay('back')}
                style={{ padding: 14, borderRadius: 10, border: '2px solid var(--verde2)', background: 'rgba(37,163,82,.15)', color: 'var(--verde2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                A Favor (Back)
              </button>
              <button type="button" onClick={() => finalizarComBackLay('lay')}
                style={{ padding: 14, borderRadius: 10, border: '2px solid #4d90d8', background: 'rgba(77,144,216,.15)', color: '#4d90d8', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                Contra (Lay)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Campo "Outros" embutido dentro da tela de Gols/Cartões/Escanteios
function MercadoOutrosInline({ prefixo, onConfirmar }) {
  const [texto, setTexto] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mercado personalizado" style={{ flex: 1 }} />
      <button type="button" disabled={!texto.trim()} onClick={() => onConfirmar(`${prefixo}${texto.trim()}`)}
        style={{ padding: '0 14px', borderRadius: 8, border: '1px solid var(--ouro)', background: 'rgba(245,197,24,.15)', color: 'var(--ouro)', fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: texto.trim() ? 1 : 0.5 }}>
        OK
      </button>
    </div>
  );
}

// Tela cheia da categoria "Outros" — mercado livre (ex: "Jogador X marca", "Escanteios no 1º Tempo Casa")
function MercadoOutrosCompleto({ onConfirmar }) {
  const [texto, setTexto] = useState('');
  return (
    <div>
      <label style={{ marginBottom: 6, display: 'block' }}>Digite o mercado</label>
      <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex: Jogador X marca" autoFocus style={{ marginBottom: 12 }} />
      <button type="button" className="btn-primary" disabled={!texto.trim()} onClick={() => onConfirmar(texto.trim())}
        style={{ width: '100%', padding: 12, borderRadius: 10, opacity: texto.trim() ? 1 : 0.5 }}>
        Confirmar
      </button>
    </div>
  );
}
