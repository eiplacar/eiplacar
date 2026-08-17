import { useEffect, useMemo, useState } from 'react';
import { Trophy, Shield, Share2, CheckCircle2, Home, Plane, RotateCcw, X, Check, ShieldQuestion } from 'lucide-react';

// ══ Seletor da Análise (Campeonato + Confronto) — terceiro módulo migrado para React ══
//
// Este componente cuida só da PARTE DE SELEÇÃO da aba Análise (era
// public/js/09-analise.js, linhas 5–83). O cálculo pesado de estatísticas
// (Poisson, força do adversário, mercados de over/under etc.) também já é
// React — src/components/AnaliseResultado.jsx — só que a matemática em si
// (~350 linhas) continua sendo a mesma função JS pura de sempre.
//
// Pontes com o restante do app, que ainda é JS puro:
//   - window.jogosCache          → array de jogos
//   - window.filtro               → { casa:{local,qty}, vis:{local,qty} }, lido pelo
//                                    cálculo de estatísticas (window.renderAnalise)
//   - window.renderAnalise()      → recalcula (computeAnalise) e avisa o componente
//                                    AnaliseResultado.jsx pra redesenhar
//   - window.escudoImgOuIcone(nome) / window.comEspeciaisPorUltimo(camps)
//   - window.analiseReactRefresh  → "sininho": o goTo('analise') do nav ainda chama
//                                    esse nome pra avisar o componente ao trocar de aba

function EscudoBox({ html }) {
  const style = { width: 30, height: 30, fontSize: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  if (html && html.includes('<img')) {
    return <div className="escudo-sel" style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <div className="escudo-sel" style={style}><Shield size={15} /></div>;
}

// Escudo do time (se já cadastrado na Aba Dados/Confrontos) ou um ícone genérico —
// mesmo padrão usado na aba Estratégias, pra ficar igual em toda a lista de seleção.
function EscudoImg({ nome, size = 22 }) {
  const url = window.getEscudo ? window.getEscudo(nome) : null;
  if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
  return <ShieldQuestion size={size * 0.8} color="var(--texto2)" style={{ flexShrink: 0 }} />;
}

// Bottom-sheet com busca + escudo de cada time — bem mais rápido que rolar um
// <select> nativo pra achar o time, principalmente em campeonatos com 20+ times.
// Mesmo padrão (SeletorSheet) já usado na aba Estratégias pra Mandante/Visitante.
function SeletorTimeSheet({ titulo, times, valorAtual, onSelecionar, onFechar }) {
  const [busca, setBusca] = useState('');
  const filtrados = busca ? times.filter((t) => t.toLowerCase().includes(busca.toLowerCase())) : times;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={onFechar}>
      <div style={{ background: 'var(--c2)', width: '100%', maxHeight: '78vh', borderRadius: '16px 16px 0 0', padding: '14px 16px 20px', overflowY: 'auto', borderTop: '1px solid var(--c3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{titulo}</div>
          <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', color: 'var(--texto2)', padding: 4, cursor: 'pointer' }}><X size={20} /></button>
        </div>
        {times.length > 8 && (
          <input autoFocus placeholder="Buscar time..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
        )}
        <div>
          {filtrados.map((t) => (
            <div key={t} onClick={() => { onSelecionar(t); onFechar(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px', borderBottom: '1px solid var(--c3)', cursor: 'pointer', borderRadius: 6, background: t === valorAtual ? 'rgba(77,216,122,0.08)' : 'transparent' }}>
              <EscudoImg nome={t} size={24} />
              <span style={{ flex: 1, fontSize: 13.5 }}>{t}</span>
              {t === valorAtual && <Check size={16} color="var(--verde2)" />}
            </div>
          ))}
          {!filtrados.length && <div style={{ textAlign: 'center', color: 'var(--texto2)', padding: 20, fontSize: 13 }}>Nada encontrado.</div>}
        </div>
      </div>
    </div>
  );
}

export default function SeletorAnalise() {
  const [, setTick] = useState(0);
  const [campeonato, setCampeonato] = useState('');
  const [timeCasa, setTimeCasa] = useState('');
  const [timeVis, setTimeVis] = useState('');
  const [escopo, setEscopo] = useState('ambos'); // 'casa' | 'vis' | 'ambos'
  const [localUnicoAtivo, setLocalUnicoAtivo] = useState('all');
  const [qtyUnicoDisplay, setQtyUnicoDisplay] = useState('');
  const [filtroCasa, setFiltroCasa] = useState({ local: 'all', qty: 0 });
  const [filtroVis, setFiltroVis] = useState({ local: 'all', qty: 0 });
  const [modoTempo, setModoTempo] = useState('ft'); // 'ft' = Resultado Final · 'ht' = Resultado 1º Tempo
  const [seletorAberto, setSeletorAberto] = useState(null); // null | 'casa' | 'vis'

  useEffect(() => {
    window.analiseReactRefresh = () => setTick((t) => t + 1);
    return () => { delete window.analiseReactRefresh; };
  }, []);

  const jogosCache = window.jogosCache || [];
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());

  const allCamps = useMemo(() => sortNatural([...new Set(jogosCache.map((j) => j.camp))]), [jogosCache]);
  const listaCamps = useMemo(() => {
    const especiais = window.comEspeciaisPorUltimo;
    return especiais ? especiais(allCamps) : allCamps;
  }, [allCamps]);

  const times = useMemo(() => {
    const jogos = campeonato ? jogosCache.filter((j) => j.camp === campeonato) : jogosCache;
    return [...new Set([...jogos.map((j) => j.casa), ...jogos.map((j) => j.vis)])].sort();
  }, [jogosCache, campeonato]);

  // Se o campeonato mudar e o time selecionado não existir mais na lista filtrada, limpa.
  useEffect(() => {
    if (timeCasa && !times.includes(timeCasa)) setTimeCasa('');
    if (timeVis && !times.includes(timeVis)) setTimeVis('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campeonato]);

  // Ponte: mantém window.filtro sempre sincronizado com o estado React,
  // e pede pro cálculo de estatísticas (ainda JS puro) redesenhar.
  useEffect(() => {
    if (!window.filtro) window.filtro = { casa: { local: 'all', qty: 0 }, vis: { local: 'all', qty: 0 } };
    window.filtro.casa.local = filtroCasa.local;
    window.filtro.casa.qty = filtroCasa.qty;
    window.filtro.vis.local = filtroVis.local;
    window.filtro.vis.qty = filtroVis.qty;
    window.filtro.modoTempo = modoTempo;
    window.renderAnalise?.();
  }, [timeCasa, timeVis, campeonato, filtroCasa, filtroVis, modoTempo]);

  function onChangeCampeonato(e) { setCampeonato(e.target.value); }
  function escolherTimeCasa(nome) { setTimeCasa(nome); setFiltroCasa((f) => ({ ...f, qty: 0 })); setQtyUnicoDisplay(''); }
  function escolherTimeVis(nome) { setTimeVis(nome); setFiltroVis((f) => ({ ...f, qty: 0 })); setQtyUnicoDisplay(''); }

  function escolherLocal(local) {
    setLocalUnicoAtivo(local);
    if (escopo === 'casa' || escopo === 'ambos') setFiltroCasa((f) => ({ ...f, local, qty: 0 }));
    if (escopo === 'vis' || escopo === 'ambos') setFiltroVis((f) => ({ ...f, local, qty: 0 }));
    setQtyUnicoDisplay('');
  }

  function onQtyInputUnico(e) {
    const raw = e.target.value;
    setQtyUnicoDisplay(raw);
    const n = parseInt(raw, 10);
    const qty = isNaN(n) || n < 1 ? 0 : n;
    if (escopo === 'casa' || escopo === 'ambos') setFiltroCasa((f) => ({ ...f, qty }));
    if (escopo === 'vis' || escopo === 'ambos') setFiltroVis((f) => ({ ...f, qty }));
  }

  function ctxTag(nome, filtro) {
    if (!nome) return null;
    const locLabel = filtro.local === 'all' ? 'Geral' : filtro.local === 'casa' ? 'Em casa' : 'Fora';
    const qtyLabel = filtro.qty > 0 ? `Últ. ${filtro.qty} jogo(s)` : 'Todos os jogos';
    return <div className="ctx-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> {nome} · {locLabel} · {qtyLabel}</div>;
  }

  const escudoCasaHtml = window.escudoImgOuIcone ? window.escudoImgOuIcone(timeCasa) : null;
  const escudoVisHtml = window.escudoImgOuIcone ? window.escudoImgOuIcone(timeVis) : null;

  const btnStyle = { flex: 1, padding: '7px 4px', fontSize: 11 };
  const btnStyleLocal = { flex: 1, padding: '7px 4px', fontSize: 12 };

  return (
    <>
      {/* 1º CAMPEONATO — filtra os times abaixo */}
      <div className="sel-card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div className="sel-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Campeonato</div>
          <button
            onClick={() => window.compartilhar?.()}
            title="Compartilhar análise"
            style={{ flexShrink: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--texto2)', cursor: 'pointer' }}
          >
            <Share2 size={14} />
          </button>
        </div>
        <select id="selCampAnalise" value={campeonato} onChange={onChangeCampeonato}>
          <option value="">Todos os campeonatos</option>
          {listaCamps.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>Selecione um campeonato para filtrar os times disponíveis</div>
      </div>

      {/* 2º CONFRONTO — card único, sem cor de time. Mandante sempre à esquerda, visitante à direita */}
      <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 14, padding: 14, marginBottom: 10 }}>

        {/* Resultado Final × Resultado 1º Tempo — decide se a Probabilidade e os
            mercados de resultado usam o placar do jogo inteiro ou só o 1º tempo
            (mesma base de dados, Gols HT, já cadastrada em Adicionar Partida). */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          <button className={`local-btn ${modoTempo === 'ft' ? 'active-all' : ''}`} onClick={() => setModoTempo('ft')} style={{ ...btnStyleLocal, flex: 1 }}>Resultado Final</button>
          <button className={`local-btn ${modoTempo === 'ht' ? 'active-all' : ''}`} onClick={() => setModoTempo('ht')} style={{ ...btnStyleLocal, flex: 1 }}>1º Tempo</button>
        </div>

        {/* Pontes ocultas — 09-analise.js e 10-compartilhar.js ainda leem #selCasa/#selVis
            direto do DOM (JS puro, fora do React). Antes eram os <select> de verdade;
            agora que viraram o SeletorTimeSheet (botão + bottom-sheet com busca/escudo),
            ficam aqui como inputs escondidos, sempre sincronizados com o estado. */}
        <input type="hidden" id="selCasa" value={timeCasa} readOnly />
        <input type="hidden" id="selVis" value={timeVis} readOnly />

        {/* Cabeçalho: escudo + mandante × visitante + escudo — clique abre o seletor com busca */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <button type="button" onClick={() => setSeletorAberto('casa')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '6px', cursor: 'pointer', textAlign: 'left' }}>
            <EscudoBox html={escudoCasaHtml} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: timeCasa ? 'var(--texto)' : 'var(--texto2)', fontSize: 12, fontWeight: 800 }}>{timeCasa || '— Mandante —'}</span>
          </button>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--texto2)' }}>×</div>
          <button type="button" onClick={() => setSeletorAberto('vis')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '6px', cursor: 'pointer', textAlign: 'right', justifyContent: 'flex-end' }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: timeVis ? 'var(--texto)' : 'var(--texto2)', fontSize: 12, fontWeight: 800 }}>{timeVis || '— Visitante —'}</span>
            <EscudoBox html={escudoVisHtml} />
          </button>
        </div>

        {seletorAberto === 'casa' && (
          <SeletorTimeSheet titulo="Escolha o Mandante" times={times} valorAtual={timeCasa} onSelecionar={escolherTimeCasa} onFechar={() => setSeletorAberto(null)} />
        )}
        {seletorAberto === 'vis' && (
          <SeletorTimeSheet titulo="Escolha o Visitante" times={times} valorAtual={timeVis} onSelecionar={escolherTimeVis} onFechar={() => setSeletorAberto(null)} />
        )}

        {/* Caixa de filtro única */}
        <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 6, fontWeight: 700, letterSpacing: '.3px' }}>APLICAR FILTRO PARA</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button className={`local-btn ${escopo === 'casa' ? 'active-all' : ''}`} onClick={() => setEscopo('casa')} style={btnStyle}>Mandante</button>
            <button className={`local-btn ${escopo === 'ambos' ? 'active-all' : ''}`} onClick={() => setEscopo('ambos')} style={btnStyle}>Ambos</button>
            <button className={`local-btn ${escopo === 'vis' ? 'active-all' : ''}`} onClick={() => setEscopo('vis')} style={btnStyle}>Visitante</button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button className={`local-btn ${localUnicoAtivo === 'all' ? 'active-all' : ''}`} onClick={() => escolherLocal('all')} style={{ ...btnStyleLocal, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><RotateCcw size={12} /> Geral</button>
            <button className={`local-btn ${localUnicoAtivo === 'casa' ? 'active-casa' : ''}`} onClick={() => escolherLocal('casa')} style={{ ...btnStyleLocal, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Home size={12} /> Em casa</button>
            <button className={`local-btn ${localUnicoAtivo === 'fora' ? 'active-fora' : ''}`} onClick={() => escolherLocal('fora')} style={{ ...btnStyleLocal, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Plane size={12} /> Fora</button>
          </div>

          <input className="qty-input" type="number" min="1" placeholder="Últimos jogos (em branco = todos)" value={qtyUnicoDisplay} onChange={onQtyInputUnico} style={{ width: '100%', fontSize: 12, padding: '7px 8px' }} />
        </div>

        {/* Estado atual de cada time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
          <div>{ctxTag(timeCasa, filtroCasa)}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', textAlign: 'right' }}>{ctxTag(timeVis, filtroVis)}</div>
        </div>
      </div>
    </>
  );
}
