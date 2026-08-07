import { useEffect, useRef, useState } from 'react';
import { Target, BarChart3, Flag, Square, Search, AlertTriangle, MapPin, Trophy, Scale, Goal, Handshake, Clock, Calendar, Timer, Home, Plane, ShieldAlert, Sunrise, Zap, Flame, X, Footprints, Award } from 'lucide-react';

const PERIODO_ICONE = { inicio: Sunrise, fimPrimeiro: Zap, inicioSegundo: Flame, final: Flag };

// ══ Resultado da Análise — sétimo módulo migrado para React ══
//
// Este componente desenha o que antes era o innerHTML gigante de
// public/js/09-analise.js (função renderAnalise). A matemática pesada
// (Poisson, Índice de Força, mercados de over/under etc.) continua sendo
// EXATAMENTE o mesmo JS puro de antes — só que agora organizada numa função
// pura `computeAnalise()` que devolve dados, sem tocar em DOM. Só duas
// peças pequenas e 100% visuais (a tabela de "Minutos dos Gols" e a barra
// de confiança) continuam vindo como HTML pronto, via dangerouslySetInnerHTML
// — mesmo recurso já usado pros escudos de time no SeletorAnalise.jsx.
//
// Pontes com o restante do app, que ainda é JS puro:
//   - window.computeAnalise(casa, vis, camp, filtro) → motor de cálculo (public/js/09-analise.js)
//   - window.analiseResultado         → último resultado calculado (setado por renderAnalise())
//   - window.analiseResultadoRefresh  → "sininho": renderAnalise() chama isso pra avisar
//                                        este componente que precisa redesenhar
//   - window.renderMinTabela(s) / window.calDot(r,tam) / window.calLbl(r,tam)
//   - window.barraConfianca(pct, casa, vis, confCasa, confVis)

function GolRow({ label, pct, cor }) {
  return (
    <div className="gol-row">
      <div className="gr-label">{label}</div>
      <div className="gr-bar"><div className="gr-fill" style={{ width: `${pct}%`, background: cor }} /></div>
      <div className="gr-pct">{pct}%</div>
    </div>
  );
}

function HtmlChunk({ html }) {
  const ref = useRef(null);
  useEffect(() => { window.renderIcons?.(ref.current); }, [html]);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

const localLbl = (loc) => (loc === 'all' ? 'Geral' : loc === 'casa' ? 'Em casa' : 'Fora');

export default function AnaliseResultado() {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState('prob');
  const [jogoSel, setJogoSel] = useState(null);

  useEffect(() => {
    window.analiseResultadoRefresh = () => setTick((t) => t + 1);
    return () => { delete window.analiseResultadoRefresh; };
  }, []);

  const data = window.analiseResultado || { estado: 'faltam-times' };

  if (data.estado === 'faltam-times') {
    return <div className="empty"><div className="icon"><Search size={26} /></div><p>Selecione os dois times para ver a análise.</p></div>;
  }
  if (data.estado === 'times-iguais') {
    return <div className="empty"><div className="icon"><AlertTriangle size={26} /></div><p>Selecione times diferentes.</p></div>;
  }
  if (data.estado === 'sem-jogos') {
    return <div className="empty"><div className="icon"><Search size={26} /></div><p>Sem jogos encontrados com os filtros selecionados.<br />Tente ajustar o local ou a quantidade.</p></div>;
  }

  const { casa, vis, filtro, sC, sV, lambdaC, lambdaV, pVit, pEmp, pDer, o15, o25, o35, o45, temHT, o05HT, o15HT, o25HT, o35HT, o45HT, resultadoHT, pBtts, mcc, top10, maxPP, momStats, golsComb, picoIdx, baixoIdx, totalMom } = data;
  const modoTempo = data.modoTempo || 'ft';
  const calDot = window.calDot || (() => 'facil');
  const calLbl = window.calLbl || (() => '—');
  const renderMinTabela = window.renderMinTabela || (() => '');
  const barraConfianca = window.barraConfianca || (() => '');

  const golsHT = temHT ? [
    { l: 'Mais de 0.5 gols no HT', p: o05HT, c: 'var(--verde2)' },
    { l: 'Menos de 0.5 gols no HT', p: 100 - o05HT, c: 'var(--perigo)' },
    { l: 'Mais de 1.5 gols no HT', p: o15HT, c: 'var(--verde2)' },
    { l: 'Menos de 1.5 gols no HT', p: 100 - o15HT, c: 'var(--perigo)' },
    { l: 'Mais de 2.5 gols no HT', p: o25HT, c: 'var(--verde2)' },
    { l: 'Menos de 2.5 gols no HT', p: 100 - o25HT, c: 'var(--perigo)' },
    { l: 'Mais de 3.5 gols no HT', p: o35HT, c: 'var(--verde2)' },
    { l: 'Menos de 3.5 gols no HT', p: 100 - o35HT, c: 'var(--perigo)' },
    { l: 'Mais de 4.5 gols no HT', p: o45HT, c: 'var(--verde2)' },
    { l: 'Menos de 4.5 gols no HT', p: 100 - o45HT, c: 'var(--perigo)' },
  ] : [];
  const golsFT = [
    { l: 'Mais de 1.5 gols', p: o15, c: 'var(--verde2)' }, { l: 'Menos de 1.5 gols', p: 100 - o15, c: 'var(--perigo)' },
    { l: 'Mais de 2.5 gols', p: o25, c: 'var(--verde2)' }, { l: 'Menos de 2.5 gols', p: 100 - o25, c: 'var(--perigo)' },
    { l: 'Mais de 3.5 gols', p: o35, c: 'var(--verde2)' }, { l: 'Menos de 3.5 gols', p: 100 - o35, c: 'var(--perigo)' },
    { l: 'Mais de 4.5 gols', p: o45, c: 'var(--verde2)' }, { l: 'Menos de 4.5 gols', p: 100 - o45, c: 'var(--perigo)' },
  ];
  const times = [{ s: sC, nome: casa, cor: 'var(--verde2)', Ico: Home }, { s: sV, nome: vis, cor: 'var(--perigo)', Ico: Plane }];

  return (
    <>
      <div className="sub-nav">
        <button className={`sub-tab ${tab === 'prob' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('prob'); }}><Target size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Probabilidade</button>
        <button className={`sub-tab ${tab === 'estat' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('estat'); }}><BarChart3 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Estatísticas</button>
      </div>

      <div className={`sub-page ${tab === 'prob' ? 'active' : ''}`}>
        <div className="sec">
          <div className="sec-title"><MapPin size={14} style={{ marginRight: 4 }} />Base da análise</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--verde2)', fontWeight: 800 }}>{casa}</span><br />
              <span style={{ color: 'var(--texto2)' }}>{localLbl(filtro.casa.local)} · {sC.nt} jogo(s)</span><br />
              <span style={{ color: 'var(--ouro)', fontWeight: 700, fontSize: 15 }}>λ {sC.lambdaAjustado}</span>
            </div>
            <div style={{ flex: 1, background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--perigo)', fontWeight: 800 }}>{vis}</span><br />
              <span style={{ color: 'var(--texto2)' }}>{localLbl(filtro.vis.local)} · {sV.nt} jogo(s)</span><br />
              <span style={{ color: 'var(--ouro)', fontWeight: 700, fontSize: 15 }}>λ {sV.lambdaAjustado}</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>Gols pela força do adversário em cada jogo (ranking).</div>
        </div>

        <div className="sec">
          <div className="sec-title"><Trophy size={14} style={{ marginRight: 4 }} />Resultado Provável {modoTempo === 'ht' ? '— 1º Tempo' : '— Final'}</div>
          {modoTempo === 'ht' && !temHT ? (
            <div className="empty" style={{ padding: 14 }}><p style={{ fontSize: 12 }}>Sem gols de 1º tempo registrados pra esses times ainda. Cadastre o placar do 1º tempo em Adicionar Partida pra liberar essa visão.</p></div>
          ) : (
            <>
              <div className="prob-resultado">
                <div className="prob-box"><div className="pb-label">{casa}</div><div className="pb-pct" style={{ color: 'var(--verde2)' }}>{modoTempo === 'ht' ? resultadoHT.pVit : pVit}%</div><div className="pb-sub">VITÓRIA</div></div>
                <div className="prob-box"><div className="pb-label">Empate</div><div className="pb-pct" style={{ color: 'var(--ouro)' }}>{modoTempo === 'ht' ? resultadoHT.pEmp : pEmp}%</div><div className="pb-sub">EMPATE</div></div>
                <div className="prob-box"><div className="pb-label">{vis}</div><div className="pb-pct" style={{ color: 'var(--perigo)' }}>{modoTempo === 'ht' ? resultadoHT.pDer : pDer}%</div><div className="pb-sub">VITÓRIA</div></div>
              </div>
              <div className="bar-wrap">
                {(() => { const v = modoTempo === 'ht' ? resultadoHT.pVit : pVit, e = modoTempo === 'ht' ? resultadoHT.pEmp : pEmp, d = modoTempo === 'ht' ? resultadoHT.pDer : pDer; return (
                  <>
                    <div className="bar-labels"><span>{casa} {v}%</span><span>Empate {e}%</span><span>{vis} {d}%</span></div>
                    <div className="bar-track"><div className="bs v" style={{ width: `${v}%` }} /><div className="bs e" style={{ width: `${e}%` }} /><div className="bs d" style={{ width: `${d}%` }} /></div>
                  </>
                ); })()}
              </div>
            </>
          )}
        </div>

        <div className="sec">
          <div className="sec-title"><Scale size={14} style={{ marginRight: 4 }} />Índice de Força (Ofensivo)</div>
          <details style={{ marginBottom: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--texto2)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={11} /> Como é calculado?
            </summary>
            <div style={{ fontSize: 10, color: 'var(--texto2)', lineHeight: 1.6, marginTop: 6 }}>
              Combina Gols (50%), Chutes no Alvo (25%), Cantos (15%), Chutes Total (5%) e penalidade por Cartões Vermelhos (-10%), comparado à média do(s) campeonato(s). 1.00 = média da liga.
            </div>
          </details>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="stat-extra-box" style={{ flex: 1, minWidth: 140 }}>
              <div className="seb-label">{casa}</div>
              <div className="seb-val" style={{ color: sC.indiceForca >= 1 ? 'var(--verde2)' : 'var(--perigo)' }}>{sC.indiceForca?.toFixed(2) ?? '—'}</div>
              <div className="seb-sub">≈ {sC.lambdaIndice} gols esperados/jogo</div>
            </div>
            <div className="stat-extra-box" style={{ flex: 1, minWidth: 140 }}>
              <div className="seb-label">{vis}</div>
              <div className="seb-val" style={{ color: sV.indiceForca >= 1 ? 'var(--verde2)' : 'var(--perigo)' }}>{sV.indiceForca?.toFixed(2) ?? '—'}</div>
              <div className="seb-sub">≈ {sV.lambdaIndice} gols esperados/jogo</div>
            </div>
          </div>
        </div>

        {/* Mercado de Gols HT só aparece no modo 1º Tempo, e o de Gols (jogo inteiro)
            só no modo Resultado Final — cada modo mostra só a linha do tempo certo. */}
        {modoTempo === 'ht' && (
          <div className="sec">
            <div className="sec-title"><Goal size={14} style={{ marginRight: 4 }} />Mercado de Gols HT</div>
            {temHT ? golsHT.map((m) => <GolRow key={m.l} label={m.l} pct={m.p} cor={m.c} />) : <div className="empty" style={{ padding: 12 }}><p style={{ fontSize: 12 }}>Sem gols de 1º tempo registrados pra esses times ainda.</p></div>}
          </div>
        )}

        {modoTempo === 'ft' && (
          <div className="sec">
            <div className="sec-title"><Goal size={14} style={{ marginRight: 4 }} />Mercado de Gols</div>
            {golsFT.map((m) => <GolRow key={m.l} label={m.l} pct={m.p} cor={m.c} />)}
          </div>
        )}

        <div className="sec">
          <div className="sec-title"><Handshake size={14} style={{ marginRight: 4 }} />Ambas Marcam</div>
          <div className="btts-row">
            <div className="btts-box"><div className="bb-lbl">Sim</div><div className="bb-pct" style={{ color: 'var(--verde2)' }}>{pBtts}%</div></div>
            <div className="btts-box"><div className="bb-lbl">Não</div><div className="bb-pct" style={{ color: 'var(--perigo)' }}>{100 - pBtts}%</div></div>
          </div>
          <div className="lambda-note">λ {casa}: {lambdaC} · λ {vis}: {lambdaV}</div>
        </div>

        {modoTempo === 'ft' && (
          <div className="sec">
            <div className="sec-title"><Flag size={14} style={{ marginRight: 4 }} />Mercado de Cantos</div>
            {mcc.temCantos ? (
              <>
                {mcc.cantos.map((c) => (
                  <div key={c.linha}>
                    <GolRow label={`Mais de ${c.linha} cantos`} pct={c.over} cor="var(--verde2)" />
                    <GolRow label={`Menos de ${c.linha} cantos`} pct={100 - c.over} cor="var(--perigo)" />
                  </div>
                ))}
                <div className="lambda-note">Total esperado: {mcc.lambdaCantos} cantos/jogo ({casa}+{vis})</div>
                <HtmlChunk html={barraConfianca(mcc.confCantos, casa, vis, sC.confCantos, sV.confCantos)} />
              </>
            ) : <div className="empty" style={{ padding: 14 }}><p>Sem dados de cantos cadastrados para um ou ambos os times.</p></div>}
          </div>
        )}

        {modoTempo === 'ft' && (
          <div className="sec">
            <div className="sec-title"><Square size={14} style={{ marginRight: 4, color: 'var(--ouro)' }} />Mercado de Cartões</div>
            {mcc.temCartoes ? (
              <>
                {mcc.cartoes.map((c) => (
                  <div key={c.linha}>
                    <GolRow label={`Mais de ${c.linha} cartões`} pct={c.over} cor="var(--verde2)" />
                    <GolRow label={`Menos de ${c.linha} cartões`} pct={100 - c.over} cor="var(--perigo)" />
                  </div>
                ))}
                <div className="lambda-note">Total esperado: {mcc.lambdaCartoes} cartões/jogo (amarelos + vermelhos, {casa}+{vis})</div>
                <HtmlChunk html={barraConfianca(mcc.confCartoes, casa, vis, sC.confCartoes, sV.confCartoes)} />
              </>
            ) : <div className="empty" style={{ padding: 14 }}><p>Sem dados de cartões cadastrados para um ou ambos os times.</p></div>}
          </div>
        )}

        {golsComb.length > 0 && (
          <div className="sec">
            <div className="sec-title"><Clock size={14} style={{ marginRight: 4 }} />Momentos Prováveis de Gol</div>
            <div className="momento-grid">
              {momStats.map((m, i) => {
                const p = Math.round((m.count / totalMom) * 100);
                return (
                  <div key={m.l} className={`momento-box ${i === picoIdx ? 'pico' : i === baixoIdx ? 'baixo' : ''}`}>
                    {i === picoIdx && <div className="pico-tag">PICO</div>}
                    {i === baixoIdx && <div className="pico-tag" style={{ color: 'var(--texto2)' }}>BAIXO</div>}
                    <div className="mb-ico">{(() => { const Ico = PERIODO_ICONE[m.ico] || Flag; return <Ico size={16} />; })()}</div>
                    <div className="mb-per">{m.l}</div>
                    <div className="mb-pct" style={{ color: i === picoIdx ? 'var(--ouro)' : 'var(--branco)' }}>{p}%</div>
                    <div className="mb-gols">{m.count} gol(s)</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}><BarChart3 size={11} /> {golsComb.length} gols com minutos registrados</div>
          </div>
        )}

        <div className="sec">
          <div className="sec-title"><Target size={14} style={{ marginRight: 4 }} />Placar Exato — Top 10</div>
          <div className="placar-exact-list">
            {top10.map((p, i) => {
              const pp = Math.round(p.p * 1000) / 10;
              const venc = p.g1 > p.g2 ? casa : p.g1 < p.g2 ? vis : 'Empate';
              const cor = p.g1 > p.g2 ? 'var(--verde2)' : p.g1 < p.g2 ? 'var(--perigo)' : 'var(--ouro)';
              return (
                <div key={i} className="pe-item">
                  <div className="pe-placar">{p.g1} – {p.g2}</div>
                  <div className="pe-venc" style={{ color: cor }}>{venc}</div>
                  <div className="pe-bar"><div className="pe-fill" style={{ width: `${Math.round((p.p / maxPP) * 100)}%` }} /></div>
                  <div className="pe-pct">{pp}%</div>
                </div>
              );
            })}
          </div>
          <details>
            <summary className="lambda-note" style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><BarChart3 size={11} /> Ver detalhes técnicos</summary>
            <div className="lambda-note" style={{ marginTop: 4 }}>Distribuição de Poisson · λ {casa}={lambdaC} · λ {vis}={lambdaV}</div>
          </details>
        </div>
      </div>

      <div className={`sub-page ${tab === 'estat' ? 'active' : ''}`}>
        <div className="sec">
          <div className="sec-title"><MapPin size={14} style={{ marginRight: 4 }} />Adversário Médio</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--verde2)', fontWeight: 700, marginBottom: 4 }}>{casa}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ouro)' }}>#{sC.rankMedAdv ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--texto2)' }}>{sC.nt} jogo(s)</div>
            </div>
            <div style={{ flex: 1, background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--perigo)', fontWeight: 700, marginBottom: 4 }}>{vis}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ouro)' }}>#{sV.rankMedAdv ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--texto2)' }}>{sV.nt} jogo(s)</div>
            </div>
          </div>
        </div>

        <div className="sec">
          <div className="sec-title"><Trophy size={14} style={{ marginRight: 4 }} />Desempenho</div>
          {times.map(({ s, nome, cor, Ico }) => (
            <div key={`ved-${nome}`} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: cor, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Ico size={14} /> {nome}</div>
              <div className="forca-grid">
                <div className="forca-box">
                  <div className="fb-label">Em Casa ({s.nc} Jogos)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--verde2)' }}>{s.vedCasa.v}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Vitória</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ouro)' }}>{s.vedCasa.e}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Empate</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--perigo)' }}>{s.vedCasa.d}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Derrota</div></div>
                  </div>
                </div>
                <div className="forca-box">
                  <div className="fb-label">Fora ({s.nv} Jogos)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--verde2)' }}>{s.vedFora.v}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Vitória</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ouro)' }}>{s.vedFora.e}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Empate</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--perigo)' }}>{s.vedFora.d}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Derrota</div></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="sec">
          <div className="sec-title"><Scale size={14} style={{ marginRight: 4 }} />Força Casa / Fora</div>
          {times.map(({ s, nome, cor, Ico }) => (
            <div key={nome} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: cor, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Ico size={14} /> {nome}</div>
              <div className="forca-grid">
                <div className="forca-box"><div className="fb-label">Em Casa ({s.nc} Jogos)</div><div className="fb-stat"><span className="fb-val">{s.mediaGM_casa}</span> <Goal size={11} style={{ verticalAlign: -2 }} /> marcado/j</div><div className="fb-stat"><span className="fb-val">{s.mediaGS_casa}</span> <ShieldAlert size={11} style={{ verticalAlign: -2 }} /> sofrido/j</div></div>
                <div className="forca-box"><div className="fb-label">Fora ({s.nv} Jogos)</div><div className="fb-stat"><span className="fb-val">{s.mediaGM_vis}</span> <Goal size={11} style={{ verticalAlign: -2 }} /> marcado/j</div><div className="fb-stat"><span className="fb-val">{s.mediaGS_vis}</span> <ShieldAlert size={11} style={{ verticalAlign: -2 }} /> sofrido/j</div></div>
              </div>
            </div>
          ))}
        </div>

        {times.map(({ s, nome, cor }) => (
          <div className="sec" key={`cal-${nome}`}>
            <div className="sec-title"><Calendar size={14} style={{ marginRight: 4 }} />Calendário — <span style={{ color: cor }}>{nome}</span></div>
            {s.calendario.length ? (
              <>
                <div className="cal-list">
                  {s.calendario.map((c, i) => (
                    <div className="cal-item cal-item-click" key={i} onClick={() => setJogoSel({ ...c, timeRef: nome, corRef: cor })}>
                      <div className={`cal-dot ${calDot(c.rank, c.tamCamp)}`} />
                      <div style={{ minWidth: 22, fontSize: 11, color: 'var(--texto2)' }}>J{i + 1}</div>
                      <div className="cal-placar-row">
                        <div className="cal-time cal-time-casa">
                          <span style={{ color: 'var(--texto2)', fontWeight: 700 }}>#{c.rankCasa ?? '—'}</span>{' '}
                          <span style={{ color: c.casaNome === nome ? cor : 'var(--texto)' }}>{c.casaNome}</span>
                        </div>
                        <div className="cal-placar-box">{c.gC} × {c.gV}</div>
                        <div className="cal-time cal-time-vis">
                          <span style={{ color: c.visNome === nome ? cor : 'var(--texto)' }}>{c.visNome}</span>{' '}
                          <span style={{ color: 'var(--texto2)', fontWeight: 700 }}>#{c.rankVis ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cal-resumo" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--texto)' }}>{s.calendario.length} jogos</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="cal-dot dificil" style={{ display: 'inline-block' }} /> {s.calendario.filter((c) => calDot(c.rank, c.tamCamp) === 'dificil').length} difícil</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="cal-dot medio" style={{ display: 'inline-block' }} /> {s.calendario.filter((c) => calDot(c.rank, c.tamCamp) === 'medio').length} médio</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="cal-dot facil" style={{ display: 'inline-block' }} /> {s.calendario.filter((c) => calDot(c.rank, c.tamCamp) === 'facil').length} fácil</span>
                </div>
              </>
            ) : <div className="empty" style={{ padding: 16 }}><p>Sem jogos com ranking registrado.</p></div>}
          </div>
        ))}

        {times.map(({ s, nome, cor }) => (
          <div className="sec" key={`min-${nome}`}>
            <div className="sec-title"><Timer size={14} style={{ marginRight: 4 }} />Minutos dos Gols — <span style={{ color: cor }}>{nome}</span></div>
            <HtmlChunk html={renderMinTabela(s)} />
          </div>
        ))}
      </div>

      {jogoSel && (
        <div className="modal-overlay open" onClick={() => setJogoSel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ marginBottom: 2 }}>Estatísticas do jogo</h2>
              <button onClick={() => setJogoSel(null)} style={{ background: 'transparent', border: 'none', color: 'var(--texto2)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>
            <p style={{ marginBottom: 10 }}>{jogoSel.camp || 'Campeonato não informado'}{jogoSel.data ? ` · ${jogoSel.data}` : ''}</p>

            <div className="prob-resultado" style={{ marginBottom: 14 }}>
              <div className="prob-box"><div className="pb-label" style={{ color: jogoSel.casaNome === jogoSel.timeRef ? jogoSel.corRef : 'var(--texto)' }}>{jogoSel.casaNome}</div><div className="pb-pct">{jogoSel.gC}</div></div>
              <div className="prob-box"><div className="pb-label">×</div><div className="pb-pct" style={{ color: 'var(--texto2)', fontSize: 13 }}>{jogoSel.golsHT_C != null && jogoSel.golsHT_V != null ? `HT ${jogoSel.golsHT_C}-${jogoSel.golsHT_V}` : ''}</div></div>
              <div className="prob-box"><div className="pb-label" style={{ color: jogoSel.visNome === jogoSel.timeRef ? jogoSel.corRef : 'var(--texto)' }}>{jogoSel.visNome}</div><div className="pb-pct">{jogoSel.gV}</div></div>
            </div>

            <div className="forca-grid" style={{ marginBottom: 10 }}>
              <div className="forca-box">
                <div className="fb-label">{jogoSel.casaNome}</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.chutesC ?? '—'}</span> <Footprints size={11} style={{ verticalAlign: -2 }} /> chutes</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.chutesGolC ?? '—'}</span> <Goal size={11} style={{ verticalAlign: -2 }} /> no gol</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.escanteiosC ?? '—'}</span> <Flag size={11} style={{ verticalAlign: -2 }} /> escanteios</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.amarelosC ?? '—'}</span> <Square size={11} style={{ verticalAlign: -2, color: 'var(--ouro)' }} /> amarelos</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.vermelhosC ?? '—'}</span> <Square size={11} style={{ verticalAlign: -2, color: 'var(--perigo)' }} /> vermelhos</div>
              </div>
              <div className="forca-box">
                <div className="fb-label">{jogoSel.visNome}</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.chutesV ?? '—'}</span> <Footprints size={11} style={{ verticalAlign: -2 }} /> chutes</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.chutesGolV ?? '—'}</span> <Goal size={11} style={{ verticalAlign: -2 }} /> no gol</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.escanteiosV ?? '—'}</span> <Flag size={11} style={{ verticalAlign: -2 }} /> escanteios</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.amarelosV ?? '—'}</span> <Square size={11} style={{ verticalAlign: -2, color: 'var(--ouro)' }} /> amarelos</div>
                <div className="fb-stat"><span className="fb-val">{jogoSel.vermelhosV ?? '—'}</span> <Square size={11} style={{ verticalAlign: -2, color: 'var(--perigo)' }} /> vermelhos</div>
              </div>
            </div>

            {jogoSel.gols && jogoSel.gols.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--texto2)', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Award size={12} /> Gols do jogo</div>
                <div className="gol-modal-grid">
                  {jogoSel.gols.map((g, i) => (
                    <div className="gol-seq-item" key={i}>
                      <div className="gsi-num">{g.time === 'casa' ? jogoSel.casaNome : jogoSel.visNome}</div>
                      <div className="gsi-min marc">{g.min}'</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
