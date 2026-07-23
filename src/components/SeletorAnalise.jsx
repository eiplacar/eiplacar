import { useEffect, useMemo, useState } from 'react';
import { Trophy, Shield, Share2, CheckCircle2, Home, Plane, RotateCcw } from 'lucide-react';

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
//   - window.escudoImgOuIcone(nome) / window.gruposCampeonato(camps)
//   - window.analiseReactRefresh  → "sininho": o goTo('analise') do nav ainda chama
//                                    esse nome pra avisar o componente ao trocar de aba

function EscudoBox({ html }) {
  const style = { width: 30, height: 30, fontSize: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  if (html && !html.includes('🛡️')) {
    return <div className="escudo-sel" style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <div className="escudo-sel" style={style}><Shield size={15} /></div>;
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

  useEffect(() => {
    window.analiseReactRefresh = () => setTick((t) => t + 1);
    return () => { delete window.analiseReactRefresh; };
  }, []);

  const jogosCache = window.jogosCache || [];
  const gruposCampeonato = window.gruposCampeonato || ((camps) => camps.map((c) => ({ base: c, itens: [c] })));
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());

  const allCamps = useMemo(() => sortNatural([...new Set(jogosCache.map((j) => j.camp))]), [jogosCache]);
  const { comVariante, soltas } = useMemo(() => {
    const grupos = gruposCampeonato(allCamps);
    return {
      comVariante: grupos.filter((g) => g.itens.length >= 2),
      soltas: sortNatural(grupos.filter((g) => g.itens.length < 2).flatMap((g) => g.itens)),
    };
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
    window.renderAnalise?.();
  }, [timeCasa, timeVis, campeonato, filtroCasa, filtroVis]);

  function onChangeCampeonato(e) { setCampeonato(e.target.value); }
  function onChangeTimeCasa(e) { setTimeCasa(e.target.value); setFiltroCasa((f) => ({ ...f, qty: 0 })); setQtyUnicoDisplay(''); }
  function onChangeTimeVis(e) { setTimeVis(e.target.value); setFiltroVis((f) => ({ ...f, qty: 0 })); setQtyUnicoDisplay(''); }

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
    const locLabel = filtro.local === 'all' ? 'Total' : filtro.local === 'casa' ? 'Em casa' : 'Fora';
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
            style={{ flexShrink: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--azul)', cursor: 'pointer' }}
          >
            <Share2 size={14} />
          </button>
        </div>
        <select id="selCampAnalise" value={campeonato} onChange={onChangeCampeonato}>
          <option value="">Todos os campeonatos</option>
          {comVariante.map((g) => (
            <optgroup key={g.base} label={g.base}>
              {g.itens.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          ))}
          {soltas.length > 0 && (
            <optgroup label="Outras Ligas">
              {soltas.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          )}
        </select>
        <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>Selecione um campeonato para filtrar os times disponíveis</div>
      </div>

      {/* 2º CONFRONTO — card único, sem cor de time. Mandante sempre à esquerda, visitante à direita */}
      <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 14, padding: 14, marginBottom: 10 }}>

        {/* Cabeçalho: escudo + mandante × visitante + escudo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <EscudoBox html={escudoCasaHtml} />
            <select id="selCasa" value={timeCasa} onChange={onChangeTimeCasa} style={{ flex: 1, minWidth: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 6px', color: 'var(--texto)', fontSize: 12, fontWeight: 800, outline: 'none' }}>
              <option value="">— Mandante —</option>
              {times.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--texto2)' }}>×</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <select id="selVis" value={timeVis} onChange={onChangeTimeVis} style={{ flex: 1, minWidth: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 6px', color: 'var(--texto)', fontSize: 12, fontWeight: 800, outline: 'none' }}>
              <option value="">— Visitante —</option>
              {times.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <EscudoBox html={escudoVisHtml} />
          </div>
        </div>

        {/* Caixa de filtro única */}
        <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 6, fontWeight: 700, letterSpacing: '.3px' }}>APLICAR FILTRO PARA</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button className={`local-btn ${escopo === 'casa' ? 'active-all' : ''}`} onClick={() => setEscopo('casa')} style={btnStyle}>Mandante</button>
            <button className={`local-btn ${escopo === 'ambos' ? 'active-all' : ''}`} onClick={() => setEscopo('ambos')} style={btnStyle}>Ambos</button>
            <button className={`local-btn ${escopo === 'vis' ? 'active-all' : ''}`} onClick={() => setEscopo('vis')} style={btnStyle}>Visitante</button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button className={`local-btn ${localUnicoAtivo === 'all' ? 'active-all' : ''}`} onClick={() => escolherLocal('all')} style={{ ...btnStyleLocal, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><RotateCcw size={12} /> Total</button>
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
