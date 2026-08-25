import { useEffect, useRef, useState } from 'react';
import { Target, BarChart3, Flag, Square, Search, AlertTriangle, MapPin, Trophy, Scale, Goal, Handshake, Clock, Calendar, Timer, Home, Plane, ShieldAlert, Sunrise, Zap, Flame, X, Footprints, Award, TrendingUp, TrendingDown, Minus, Gauge, Star, Trash2 } from 'lucide-react';

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

// Cor de acordo com a classificação (mesma banda usada no cálculo — 17-indice.js)
function corClassificacao(label){
  if (label === 'Muito forte' || label === 'Forte') return 'var(--verde)';  // verde escuro
  if (label === 'Favorável') return 'var(--verde2)';                        // verde claro
  if (label === 'Moderado') return 'var(--ouro)';                          // amarelo dourado
  if (label === 'Arriscado' || label === 'Baixo') return 'var(--perigo)';  // vermelho
  return '#F87171'; // Muito arriscado / Muito baixo — vermelho claro
}
// Mesma banda, mas pra uma linha de gols específica (Over X.5) — usada nos badges de
// "Favoritados". Desde que a pontuação da linha passou a ser uma média ponderada (própria %
// + contexto), ela usa as MESMAS faixas do card do topo (classificar(): 80/70/60/50/40),
// pra cor e classificação ficarem consistentes em todo o app.
function corLinha(pontuacao){
  if (pontuacao>=70) return 'var(--verde)';   // Forte / Muito forte — verde escuro
  if (pontuacao>=60) return 'var(--verde2)';  // Favorável — verde claro
  if (pontuacao>=50) return 'var(--ouro)';    // Moderado — amarelo dourado
  if (pontuacao>=40) return 'var(--perigo)';  // Baixo/Arriscado — vermelho
  return '#F87171';                            // Muito baixo/Muito arriscado — vermelho claro
}

// ══ ⚡ ÍNDICE — Favorita Ponto (Resultado/Gols/BTTS) — cruza Probabilidade × Estatísticas ══
function IndiceTab({ data, favorEnviando, setFavorEnviando, tab }) {
  const idx = window.computeIndice && data?.estado === 'ok' ? window.computeIndice(data) : null;
  const favoritosAtivos = window.favIndiceAtivos ? window.favIndiceAtivos() : [];
  const [horarioJogo, setHorarioJogo] = useState('');
  const [dataJogo, setDataJogo] = useState(window.hojeBR ? window.hojeBR() : new Date().toISOString().slice(0, 10));

  async function favoritar() {
    setFavorEnviando(true);
    const jogo = horarioJogo ? { data: dataJogo, horario: horarioJogo } : null;
    const r = await window.favoritarIndice?.(data, idx, jogo);
    setFavorEnviando(false);
    if (!r || r.erro) window.toast?.(r?.erro ? `Erro ao favoritar: ${r.erro}` : 'Erro ao favoritar', true);
    else window.toast?.(horarioJogo ? 'Favoritado! Some sozinho 4h depois do início do jogo.' : 'Favoritado! Some sozinho em 4h.');
  }

  async function remover(id) {
    await window.removerFavoritoIndice?.(id);
  }

  const secaoFavoritados = (
    <div className="sec">
      <div className="sec-title"><Star size={14} style={{ marginRight: 4 }} />Favoritados ({favoritosAtivos.length})</div>
      {favoritosAtivos.length === 0 ? (
        <div className="empty" style={{ padding: 14 }}><p>Nenhum confronto favoritado ainda. Toque em "Favoritar" acima pra salvar esse aqui.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {favoritosAtivos.map((f) => (
            <div key={f.id} style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{f.casa} × {f.vis}</span>
                <button onClick={() => remover(f.id)} title="Remover" style={{ background: 'none', border: 'none', color: 'var(--texto2)', cursor: 'pointer', padding: 2 }}><Trash2 size={13} /></button>
              </div>
              {(f.camp || f.horario_jogo) && <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 6 }}>{f.camp}{f.camp && f.horario_jogo ? ' · ' : ''}{f.horario_jogo ? `${f.horario_jogo}` : ''}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                {f.resultado_favorito && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--c1)', borderRadius: 6, padding: '3px 7px', color: corClassificacao(f.resultado_classificacao) }}><Trophy size={11} /> {f.resultado_favorito} · {f.resultado_pontuacao}/100</span>}
                {f.btts_classificacao && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--c1)', borderRadius: 6, padding: '3px 7px', color: corClassificacao(f.btts_classificacao) }}><Handshake size={11} /> {f.btts_pct}% · {f.btts_pontuacao}/100</span>}
                {f.gols_linha1 && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--c1)', borderRadius: 6, padding: '3px 7px', color: corLinha(f.gols_prob1) }}><Goal size={11} /> +{f.gols_linha1} · {f.gols_prob1}/100</span>}
                {f.gols_linha2 && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--c1)', borderRadius: 6, padding: '3px 7px', color: corLinha(f.gols_prob2) }}><Goal size={11} /> +{f.gols_linha2} · {f.gols_prob2}/100</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Sem 2 times selecionados ainda: mostra só a lista de Favoritados (não precisa
  // estar analisando um confronto pra ver o que já foi favoritado antes).
  if (!idx) {
    return (
      <div className={`sub-page ${tab === 'indice' ? 'active' : ''}`}>
        {secaoFavoritados}
      </div>
    );
  }

  const { resultado, gols, btts } = idx;

  return (
    <div className={`sub-page ${tab === 'indice' ? 'active' : ''}`}>
      <div className="sec">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="sec-title" style={{ margin: 0 }}><Gauge size={14} style={{ marginRight: 4 }} />Análise do Confronto</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 9.5, color: 'var(--texto2)', display: 'block', marginBottom: 3 }}>Horário do jogo (opcional)</label>
            <input type="time" value={horarioJogo} onChange={(e) => setHorarioJogo(e.target.value)}
              style={{ width: '100%', background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: '6px 8px', color: 'var(--texto)', fontSize: 12 }} />
          </div>
          {horarioJogo && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9.5, color: 'var(--texto2)', display: 'block', marginBottom: 3 }}>Data</label>
              <input type="date" value={dataJogo} onChange={(e) => setDataJogo(e.target.value)}
                style={{ width: '100%', background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: '6px 8px', color: 'var(--texto)', fontSize: 12 }} />
            </div>
          )}
          <button onClick={favoritar} disabled={favorEnviando}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '7px 10px', color: 'var(--ouro)', fontSize: 11, fontWeight: 700, cursor: favorEnviando ? 'default' : 'pointer', opacity: favorEnviando ? .6 : 1, whiteSpace: 'nowrap' }}>
            <Star size={13} /> Favoritar
          </button>
        </div>
        {!horarioJogo && <div style={{ fontSize: 9.5, color: 'var(--texto2)', marginTop: -6, marginBottom: 10 }}>Sem horário, o favorito some 4h depois de favoritado. Preenchendo, some 4h depois do início do jogo.</div>}

        {/* 🏆 RESULTADO */}
        {resultado ? (
          <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--texto2)', fontWeight: 700, marginBottom: 6 }}><Trophy size={13} /> RESULTADO</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: corClassificacao(resultado.classificacao) }}>{resultado.favorito || 'Equilibrado'}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ouro)' }}>{resultado.pontuacao}/100</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--texto2)', marginBottom: resultado.alerta ? 8 : 0 }}>Favorita Ponto — {resultado.classificacao}</div>
            {resultado.alerta && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'rgba(212,175,55,0.1)', border: '1px solid var(--ouro)', borderRadius: 8, padding: '6px 8px', fontSize: 10.5, color: 'var(--texto)' }}>
                <AlertTriangle size={13} style={{ color: 'var(--ouro)', flexShrink: 0, marginTop: 1 }} />
                <span>O modelo probabilístico (Poisson) favorece <strong>{resultado.favModelo}</strong> — divergência entre a probabilidade pura e os indicadores de desempenho.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="empty" style={{ padding: 14 }}><p>Dados insuficientes pra calcular a Favorita Ponto de Resultado.</p></div>
        )}

        {/* ⚽ GOLS */}
        <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--texto2)', fontWeight: 700, marginBottom: 6 }}><Goal size={13} /> GOLS</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: corClassificacao(gols.classificacao) }}>{gols.classificacao}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ouro)' }}>{gols.pontuacao}/100</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 6 }}>Mercados mais pontuados: <strong style={{ color: corClassificacao(gols.top2[0]?.label) }}>+{gols.top2[0]?.linha} · {gols.top2[0]?.pontuacao}/100 ({gols.top2[0]?.label})</strong>{gols.top2[1] && <> e <strong style={{ color: corClassificacao(gols.top2[1].label) }}>+{gols.top2[1].linha} · {gols.top2[1].pontuacao}/100 ({gols.top2[1].label})</strong></>}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {gols.linhas.map((l) => (
              <div key={l.linha} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                <span>Over {l.linha}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--texto2)' }}>{l.prob}%</span>
                  <span style={{ color: l.cor, fontWeight: 700 }}>{l.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 🤝 BTTS */}
        <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--texto2)', fontWeight: 700, marginBottom: 6 }}><Handshake size={13} /> BTTS (AMBAS MARCAM)</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: corClassificacao(btts.classificacao) }}>{btts.classificacao}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ouro)' }}>{btts.pontuacao}/100</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--texto2)' }}>BTTS Sim: <strong style={{ color: 'var(--texto)' }}>{btts.pctSim}%</strong> · BTTS Não: <strong style={{ color: 'var(--texto)' }}>{100 - btts.pctSim}%</strong></div>
        </div>
      </div>

      {/* ⭐ Favoritados — privado da SUA conta, some 4h depois do início do jogo (ou 4h
          depois de favoritado, se não informou horário) */}
      {secaoFavoritados}
    </div>
  );
}

export default function AnaliseResultado() {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState('prob');
  const [jogoSel, setJogoSel] = useState(null);
  const [favorEnviando, setFavorEnviando] = useState(false);

  useEffect(() => {
    window.analiseResultadoRefresh = () => setTick((t) => t + 1);
    window.favIndiceRefresh = () => setTick((t) => t + 1);
    return () => { delete window.analiseResultadoRefresh; delete window.favIndiceRefresh; };
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

  const { casa, vis, filtro, sC, sV, lambdaC, lambdaV, pVit, pEmp, pDer, o15, o25, o35, o45, temHT, o05HT, o15HT, o25HT, o35HT, o45HT, resultadoHT, pBtts, pBttsHT, mcc, top10, maxPP, top10HT, maxPPHT, momStats, golsComb, picoIdx, baixoIdx, totalMom, momStatsHT, golsCombHT, picoIdxHT, baixoIdxHT, totalMomHT, faixaC, faixaV, tendC, tendV, tendCHT, tendVHT } = data;
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
        <button className={`sub-tab ${tab === 'indice' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('indice'); }}><Gauge size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Índice</button>
      </div>

      <div className={`sub-page ${tab === 'prob' ? 'active' : ''}`}>
        <div className="sec">
          <div className="sec-title"><MapPin size={14} style={{ marginRight: 4 }} />Base da análise</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--verde2)', fontWeight: 800 }}>{casa}</span><br />
              <span style={{ color: 'var(--texto2)' }}>{localLbl(filtro.casa.local)} · {sC.nt} jogo(s){modoTempo === 'ht' ? ` · ${sC.ntHT} com HT` : ''}</span><br />
              <span style={{ color: 'var(--ouro)', fontWeight: 700, fontSize: 15 }}>λ {modoTempo === 'ht' ? (temHT ? sC.lambdaHT : '—') : sC.lambdaAjustado}</span>
            </div>
            <div style={{ flex: 1, background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--perigo)', fontWeight: 800 }}>{vis}</span><br />
              <span style={{ color: 'var(--texto2)' }}>{localLbl(filtro.vis.local)} · {sV.nt} jogo(s){modoTempo === 'ht' ? ` · ${sV.ntHT} com HT` : ''}</span><br />
              <span style={{ color: 'var(--ouro)', fontWeight: 700, fontSize: 15 }}>λ {modoTempo === 'ht' ? (temHT ? sV.lambdaHT : '—') : sV.lambdaAjustado}</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>{modoTempo === 'ht' ? 'Gols do 1º tempo (HT) marcados/sofridos em média.' : 'Gols pela força do adversário em cada jogo (ranking).'}</div>
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

        {modoTempo === 'ft' ? (
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
        ) : (
          <div className="sec">
            <div className="sec-title"><Scale size={14} style={{ marginRight: 4 }} />Índice de Força (Ofensivo)</div>
            <div className="empty" style={{ padding: 14 }}><p style={{ fontSize: 12 }}>Esse índice usa chutes, cantos e cartões, que só temos fechados por partida inteira (sem minuto/tempo). Disponível só em Resultado Final.</p></div>
          </div>
        )}

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
          <div className="sec-title"><Handshake size={14} style={{ marginRight: 4 }} />Ambas Marcam {modoTempo === 'ht' ? '— 1º Tempo' : ''}</div>
          {modoTempo === 'ht' && !temHT ? (
            <div className="empty" style={{ padding: 14 }}><p style={{ fontSize: 12 }}>Sem gols de 1º tempo registrados pra esses times ainda.</p></div>
          ) : (
            <>
              <div className="btts-row">
                <div className="btts-box"><div className="bb-lbl">Sim</div><div className="bb-pct" style={{ color: 'var(--verde2)' }}>{modoTempo === 'ht' ? pBttsHT : pBtts}%</div></div>
                <div className="btts-box"><div className="bb-lbl">Não</div><div className="bb-pct" style={{ color: 'var(--perigo)' }}>{100 - (modoTempo === 'ht' ? pBttsHT : pBtts)}%</div></div>
              </div>
              <div className="lambda-note">{modoTempo === 'ht' ? <>λ HT {casa}: {sC.lambdaHT} · λ HT {vis}: {sV.lambdaHT}</> : <>λ {casa}: {lambdaC} · λ {vis}: {lambdaV}</>}</div>
            </>
          )}
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

        {(modoTempo === 'ht' ? golsCombHT.length > 0 : golsComb.length > 0) && (
          <div className="sec">
            <div className="sec-title"><Clock size={14} style={{ marginRight: 4 }} />Momentos Prováveis de Gol {modoTempo === 'ht' ? '— 1º Tempo' : ''}</div>
            <div className="momento-grid">
              {(modoTempo === 'ht' ? momStatsHT : momStats).map((m, i) => {
                const total = modoTempo === 'ht' ? totalMomHT : totalMom;
                const pico = modoTempo === 'ht' ? picoIdxHT : picoIdx;
                const baixo = modoTempo === 'ht' ? baixoIdxHT : baixoIdx;
                const p = Math.round((m.count / total) * 100);
                return (
                  <div key={m.l} className={`momento-box ${i === pico ? 'pico' : i === baixo ? 'baixo' : ''}`}>
                    {i === pico && <div className="pico-tag">PICO</div>}
                    {i === baixo && <div className="pico-tag" style={{ color: 'var(--texto2)' }}>BAIXO</div>}
                    <div className="mb-ico">{(() => { const Ico = PERIODO_ICONE[m.ico] || Flag; return <Ico size={16} />; })()}</div>
                    <div className="mb-per">{m.l}</div>
                    <div className="mb-pct" style={{ color: i === pico ? 'var(--ouro)' : 'var(--branco)' }}>{p}%</div>
                    <div className="mb-gols">{m.count} gol(s)</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}><BarChart3 size={11} /> {(modoTempo === 'ht' ? golsCombHT : golsComb).length} gols com minutos registrados</div>
          </div>
        )}

        <div className="sec">
          <div className="sec-title"><Target size={14} style={{ marginRight: 4 }} />Placar Exato — Top 10 {modoTempo === 'ht' ? '(1º Tempo)' : ''}</div>
          {modoTempo === 'ht' && !temHT ? (
            <div className="empty" style={{ padding: 14 }}><p style={{ fontSize: 12 }}>Sem gols de 1º tempo registrados pra esses times ainda.</p></div>
          ) : (
            <>
              <div className="placar-exact-list">
                {(modoTempo === 'ht' ? top10HT : top10).map((p, i) => {
                  const maxP = modoTempo === 'ht' ? maxPPHT : maxPP;
                  const pp = Math.round(p.p * 1000) / 10;
                  const venc = p.g1 > p.g2 ? casa : p.g1 < p.g2 ? vis : 'Empate';
                  const cor = p.g1 > p.g2 ? 'var(--verde2)' : p.g1 < p.g2 ? 'var(--perigo)' : 'var(--ouro)';
                  return (
                    <div key={i} className="pe-item">
                      <div className="pe-placar">{p.g1} – {p.g2}</div>
                      <div className="pe-venc" style={{ color: cor }}>{venc}</div>
                      <div className="pe-bar"><div className="pe-fill" style={{ width: `${Math.round((p.p / maxP) * 100)}%` }} /></div>
                      <div className="pe-pct">{pp}%</div>
                    </div>
                  );
                })}
              </div>
              <details>
                <summary className="lambda-note" style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><BarChart3 size={11} /> Ver detalhes técnicos</summary>
                <div className="lambda-note" style={{ marginTop: 4 }}>{modoTempo === 'ht' ? <>Distribuição de Poisson · λ HT {casa}={sC.lambdaHT} · λ HT {vis}={sV.lambdaHT}</> : <>Distribuição de Poisson · λ {casa}={lambdaC} · λ {vis}={lambdaV}</>}</div>
              </details>
            </>
          )}
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
          <div className="sec-title"><Scale size={14} style={{ marginRight: 4 }} />Desempenho Contra Adversários de Força Similar</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[{ nome: casa, cor: 'var(--verde2)', faixa: faixaC, rankRival: sV.rankMedProprio }, { nome: vis, cor: 'var(--perigo)', faixa: faixaV, rankRival: sC.rankMedProprio }].map(({ nome, cor, faixa, rankRival }) => (
              <div key={nome} style={{ flex: 1, minWidth: 150, background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, color: cor, fontWeight: 700, marginBottom: 2 }}>{nome}</div>
                {faixa ? (
                  <>
                    <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 6 }}>Contra adversários próximos do nível atual (rank #{rankRival ?? '—'} · {faixa.jogos} jogo(s))</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--texto2)' }}>{faixa.v}V {faixa.e}E {faixa.d}D</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ouro)' }}>{faixa.aproveitamento}%</span>
                    </div>
                  </>
                ) : <div style={{ fontSize: 11, color: 'var(--texto2)' }}>Sem jogos suficientes contra esse nível de adversário ainda.</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="sec">
          <div className="sec-title"><TrendingUp size={14} style={{ marginRight: 4 }} />Tendência (Ganhando ou Perdendo Força) {modoTempo === 'ht' ? '— 1º Tempo' : ''}</div>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 10 }}>Compara os últimos 5 com os últimos 10 para identificar ganho ou perda de força.</div>
          {[{ nome: casa, cor: 'var(--verde2)', tend: modoTempo === 'ht' ? tendCHT : tendC }, { nome: vis, cor: 'var(--perigo)', tend: modoTempo === 'ht' ? tendVHT : tendV }].map(({ nome, cor, tend }) => (
            <div key={nome} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: cor, fontWeight: 700, marginBottom: 6 }}>{nome}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[{ lbl: 'Vitória', t: tend.vitoria }, { lbl: 'Over 1.5 Gols', t: tend.over15 }, { lbl: 'Ambas Marcam', t: tend.btts }].map(({ lbl, t }) => (
                  <div key={lbl} style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: t ? 6 : 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--texto)', fontWeight: 700 }}>{lbl}</span>
                      {t && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: t.tendencia === 'subindo' ? 'var(--verde2)' : t.tendencia === 'descendo' ? 'var(--perigo)' : 'var(--texto2)' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: t.tendencia === 'subindo' ? 'var(--verde2)' : t.tendencia === 'descendo' ? 'var(--perigo)' : 'var(--texto2)', flexShrink: 0 }} />
                          {t.tendencia === 'subindo' ? 'Ganhando força' : t.tendencia === 'descendo' ? 'Perdendo força' : 'Estável'}
                        </span>
                      )}
                    </div>
                    {t ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--texto2)' }}>Últimos 5</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                            <span style={{ fontSize: 15, fontWeight: 800 }}>{t.hits5}/{t.total5}</span>
                            <span style={{ fontSize: 10, color: 'var(--texto2)' }}>· {t.pct5}%</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--texto2)' }}>Últimos 10</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                            <span style={{ fontSize: 15, fontWeight: 800 }}>{t.hits10}/{t.total10}</span>
                            <span style={{ fontSize: 10, color: 'var(--texto2)' }}>· {t.pct10}%</span>
                          </div>
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                          {t.sequencia.map((h, i) => (
                            <span key={i} style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: h ? 'var(--verde2)' : 'var(--perigo)' }} />
                          ))}
                        </span>
                      </div>
                    ) : <span style={{ fontSize: 10, color: 'var(--texto2)' }}>Poucos jogos pra calcular ainda</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>


        <div className="sec">
          <div className="sec-title"><Trophy size={14} style={{ marginRight: 4 }} />Desempenho {modoTempo === 'ht' ? '— 1º Tempo' : ''}</div>
          {times.map(({ s, nome, cor, Ico }) => {
            const nc = modoTempo === 'ht' ? s.ncHT : s.nc;
            const nv = modoTempo === 'ht' ? s.nvHT : s.nv;
            const vc = modoTempo === 'ht' ? s.vedCasaHT : s.vedCasa;
            const vf = modoTempo === 'ht' ? s.vedForaHT : s.vedFora;
            return (
              <div key={`ved-${nome}`} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: cor, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Ico size={14} /> {nome}</div>
                <div className="forca-grid">
                  <div className="forca-box">
                    <div className="fb-label">Em Casa ({nc} Jogos)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--verde2)' }}>{vc.v}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Vitória</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ouro)' }}>{vc.e}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Empate</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--perigo)' }}>{vc.d}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Derrota</div></div>
                    </div>
                  </div>
                  <div className="forca-box">
                    <div className="fb-label">Fora ({nv} Jogos)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--verde2)' }}>{vf.v}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Vitória</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ouro)' }}>{vf.e}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Empate</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--perigo)' }}>{vf.d}</div><div style={{ fontSize: 9, color: 'var(--texto2)' }}>Derrota</div></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sec">
          <div className="sec-title"><Scale size={14} style={{ marginRight: 4 }} />Força Casa / Fora {modoTempo === 'ht' ? '— 1º Tempo' : ''}</div>
          {times.map(({ s, nome, cor, Ico }) => {
            const nc = modoTempo === 'ht' ? s.ncHT : s.nc;
            const nv = modoTempo === 'ht' ? s.nvHT : s.nv;
            const gmCasa = modoTempo === 'ht' ? s.mediaGM_casaHT : s.mediaGM_casa;
            const gsCasa = modoTempo === 'ht' ? s.mediaGS_casaHT : s.mediaGS_casa;
            const gmVis = modoTempo === 'ht' ? s.mediaGM_visHT : s.mediaGM_vis;
            const gsVis = modoTempo === 'ht' ? s.mediaGS_visHT : s.mediaGS_vis;
            return (
              <div key={nome} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: cor, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Ico size={14} /> {nome}</div>
                <div className="forca-grid">
                  <div className="forca-box"><div className="fb-label">Em Casa ({nc} Jogos)</div><div className="fb-stat"><span className="fb-val">{gmCasa}</span> <Goal size={11} style={{ verticalAlign: -2 }} /> marcado/j</div><div className="fb-stat"><span className="fb-val">{gsCasa}</span> <ShieldAlert size={11} style={{ verticalAlign: -2 }} /> sofrido/j</div></div>
                  <div className="forca-box"><div className="fb-label">Fora ({nv} Jogos)</div><div className="fb-stat"><span className="fb-val">{gmVis}</span> <Goal size={11} style={{ verticalAlign: -2 }} /> marcado/j</div><div className="fb-stat"><span className="fb-val">{gsVis}</span> <ShieldAlert size={11} style={{ verticalAlign: -2 }} /> sofrido/j</div></div>
                </div>
              </div>
            );
          })}
        </div>

        {times.map(({ s, nome, cor }) => {
          const calLista = modoTempo === 'ht' ? s.calendario.filter((c) => c.golsHT_C != null && c.golsHT_V != null) : s.calendario;
          return (
          <div className="sec" key={`cal-${nome}`}>
            <div className="sec-title"><Calendar size={14} style={{ marginRight: 4 }} />Calendário {modoTempo === 'ht' ? '— 1º Tempo — ' : '— '}<span style={{ color: cor }}>{nome}</span></div>
            {calLista.length ? (
              <>
                <div className="cal-list">
                  {calLista.map((c, i) => (
                    <div className="cal-item cal-item-click" key={i} onClick={() => setJogoSel({ ...c, timeRef: nome, corRef: cor })}>
                      <div className={`cal-dot ${calDot(c.rank, c.tamCamp)}`} />
                      <div style={{ minWidth: 22, fontSize: 11, color: 'var(--texto2)' }}>J{i + 1}</div>
                      <div className="cal-placar-row">
                        <div className="cal-time cal-time-casa">
                          <span style={{ color: 'var(--texto2)', fontWeight: 700 }}>#{c.rankCasa ?? '—'}</span>{' '}
                          <span style={{ color: c.casaNome === nome ? cor : 'var(--texto)' }}>{c.casaNome}</span>
                        </div>
                        <div className="cal-placar-box">
                          {modoTempo === 'ht' ? <>{c.golsHT_C} × {c.golsHT_V}</> : <>{c.gC} × {c.gV}</>}
                        </div>
                        <div className="cal-time cal-time-vis">
                          <span style={{ color: c.visNome === nome ? cor : 'var(--texto)' }}>{c.visNome}</span>{' '}
                          <span style={{ color: 'var(--texto2)', fontWeight: 700 }}>#{c.rankVis ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cal-resumo" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--texto)' }}>{calLista.length} jogos</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="cal-dot dificil" style={{ display: 'inline-block' }} /> {calLista.filter((c) => calDot(c.rank, c.tamCamp) === 'dificil').length} difícil</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="cal-dot medio" style={{ display: 'inline-block' }} /> {calLista.filter((c) => calDot(c.rank, c.tamCamp) === 'medio').length} médio</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span className="cal-dot facil" style={{ display: 'inline-block' }} /> {calLista.filter((c) => calDot(c.rank, c.tamCamp) === 'facil').length} fácil</span>
                </div>
              </>
            ) : <div className="empty" style={{ padding: 16 }}><p>{modoTempo === 'ht' ? 'Sem jogos com placar de 1º tempo registrado.' : 'Sem jogos com ranking registrado.'}</p></div>}
          </div>
          );
        })}

        {times.map(({ s, nome, cor }) => (
          <div className="sec" key={`min-${nome}`}>
            <div className="sec-title"><Timer size={14} style={{ marginRight: 4 }} />Minutos dos Gols {modoTempo === 'ht' ? '— 1º Tempo — ' : '— '}<span style={{ color: cor }}>{nome}</span></div>
            <HtmlChunk html={renderMinTabela(s, modoTempo)} />
          </div>
        ))}
      </div>

      <IndiceTab data={data} favorEnviando={favorEnviando} setFavorEnviando={setFavorEnviando} tab={tab} />

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
                      <div className="gsi-min marc">{g.min}{g.acr ? `+${g.acr}` : ''}'</div>
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
