import { useEffect, useRef, useState } from 'react';
import { Star, Trash2, Gauge, Trophy, Goal, Handshake, AlertTriangle } from 'lucide-react';

// ══ Página "Favoritos" — menu lateral, logo abaixo de "Análise" ══
//
// Antes essa análise (Favorita Ponto) vivia numa 3ª sub-aba "Índice" dentro de Análise,
// junto com a lista do que já tinha sido favoritado. A sub-aba Índice foi removida (Análise
// agora só tem Probabilidade e Estatísticas) e as duas coisas se mudaram pra cá:
//   1) "Análise do Confronto" — pontuação Resultado/Gols/BTTS do confronto que estiver
//      selecionado na aba Análise agora mesmo (lê window.analiseResultado, o mesmo dado
//      que computeAnalise() já calculou lá — não recalcula nada, só cruza com pesos via
//      window.computeIndice(), de public/js/17-favoritos.js) + o botão "Favoritar".
//   2) A lista dos confrontos já favoritados.
//
// window.favIndiceRefresh / window.analiseResultadoRefresh: os "sininhos" que 09-analise.js
// e 17-favoritos.js chamam pra avisar quando os dados mudam. Como esta página fica montada o
// tempo todo (troca de aba é só CSS, ver 03-nav.js) junto com AnaliseResultado.jsx, os hooks
// abaixo ENCADEIAM no que já existir, em vez de sobrescrever — as duas continuam recebendo
// o aviso, não importa a ordem de montagem.

// Classificação única (5 níveis) — Forte / Favorável / Moderado / Arriscado / Muito arriscado
// — usada em TODO indicador (Resultado, cada linha de Gols, BTTS). As cores são as oficiais
// do EI PLACAR; ver a mesma lista de nomes em public/js/17-favoritos.js (classificar()).
function corClassificacao(label) {
  if (label === 'Forte') return '#168A45';
  if (label === 'Favorável') return '#35A853';
  if (label === 'Moderado') return '#F2C94C';
  if (label === 'Arriscado') return '#F2994A';
  return '#D64545'; // Muito arriscado
}

function BadgeFavorito({ icon, cor, children }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--c1)', borderRadius: 6, padding: '3px 7px', color: cor, fontSize: 10 }}>
      {icon} {children}
    </span>
  );
}
// Cor de um badge de linha de Gols (Mais 1.5/2.5/3.5/4.5) — só a pontuação (0-100) fica salva
// no favorito, então a classificação/cor é recalculada aqui na hora com a MESMA régua do
// resto do app (window.classificar, de 17-favoritos.js).
function corLinhaGols(pontuacao) {
  if (pontuacao == null || !window.classificar) return 'var(--texto)';
  return corClassificacao(window.classificar(pontuacao));
}
function labelLinhaGols(pontuacao) {
  if (pontuacao == null || !window.classificar) return '';
  return window.classificar(pontuacao);
}
// Badge padrão de todo mercado do favorito (Resultado, Ambas Marcam, cada linha de Gols) —
// sempre 2 linhas: valor em cima, o NOME do nível (Forte/Favorável/Moderado/...) embaixo,
// na cor da classificação. Mesmo formato pros 6, pra ficar tudo consistente.
function BadgeFavoritoNivel({ valor, classificacao }) {
  return (
    <div style={{ background: 'var(--c1)', borderRadius: 8, padding: '7px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--texto)' }}>{valor}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: corClassificacao(classificacao), marginTop: 2 }}>{classificacao}</div>
    </div>
  );
}
function CabecalhoFavorito({ f, onRemover }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{f.casa} × {f.vis}</span>
        {onRemover && <button onClick={onRemover} title="Remover" style={{ background: 'none', border: 'none', color: 'var(--texto2)', cursor: 'pointer', padding: 2 }}><Trash2 size={13} /></button>}
      </div>
      {(f.camp || f.horario_jogo) && <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 6 }}>{f.camp}{f.camp && f.horario_jogo ? ' · ' : ''}{f.horario_jogo ? `${f.horario_jogo}` : ''}</div>}
    </>
  );
}

// Lista de confrontos favoritados — 1 card só por confronto, com os 6 mercados (Resultado,
// Ambas Marcam, +1.5/+2.5/+3.5/+4.5), todos no mesmo formato de badge (valor em cima, nível
// embaixo). Dois cards separados por confronto atrapalhava a leitura — voltou a ser 1 só.
function SecaoFavoritados() {
  const favoritosAtivos = window.favIndiceAtivos ? window.favIndiceAtivos() : [];
  async function remover(id) { await window.removerFavoritoIndice?.(id); }
  return (
    <div className="sec">
      <div className="sec-title"><Star size={14} style={{ marginRight: 4 }} />Favoritados ({favoritosAtivos.length})</div>
      {favoritosAtivos.length === 0 ? (
        <div className="empty" style={{ padding: 14 }}><p>Nenhum confronto favoritado ainda. Analise um confronto na aba Análise e toque em "Favoritar" aqui embaixo pra salvar esse aqui.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {favoritosAtivos.map((f) => (
            <div key={f.id} style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 10, padding: 10 }}>
              <CabecalhoFavorito f={f} onRemover={() => remover(f.id)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {f.resultado_favorito && <BadgeFavoritoNivel valor={`${f.resultado_favorito} · ${f.resultado_pontuacao}/100`} classificacao={f.resultado_classificacao} />}
                {f.btts_classificacao && <BadgeFavoritoNivel valor={`Ambas ${f.btts_pct}% · ${f.btts_pontuacao}/100`} classificacao={f.btts_classificacao} />}
                {f.gols_linha1 && <BadgeFavoritoNivel valor={`+${f.gols_linha1} · ${f.gols_prob1}/100`} classificacao={labelLinhaGols(f.gols_prob1)} />}
                {f.gols_linha2 && <BadgeFavoritoNivel valor={`+${f.gols_linha2} · ${f.gols_prob2}/100`} classificacao={labelLinhaGols(f.gols_prob2)} />}
                {f.gols_linha3 && <BadgeFavoritoNivel valor={`+${f.gols_linha3} · ${f.gols_prob3}/100`} classificacao={labelLinhaGols(f.gols_prob3)} />}
                {f.gols_linha4 && <BadgeFavoritoNivel valor={`+${f.gols_linha4} · ${f.gols_prob4}/100`} classificacao={labelLinhaGols(f.gols_prob4)} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// "Análise do Confronto" — pontuação Resultado/Gols/BTTS + botão Favoritar, do confronto
// que estiver selecionado agora na aba Análise.
function AnaliseDoConfronto() {
  const [, setTick] = useState(0);
  const [favorEnviando, setFavorEnviando] = useState(false);
  const [horarioJogo, setHorarioJogo] = useState('');
  const [dataJogo, setDataJogo] = useState(window.hojeBR ? window.hojeBR() : new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const anterior = window.analiseResultadoRefresh;
    const encadeada = () => { setTick((t) => t + 1); anterior?.(); };
    window.analiseResultadoRefresh = encadeada;
    return () => { if (window.analiseResultadoRefresh === encadeada) window.analiseResultadoRefresh = anterior; };
  }, []);

  const data = window.analiseResultado;
  const idx = window.computeIndice && data?.estado === 'ok' ? window.computeIndice(data) : null;

  if (!idx) {
    return <div className="empty" style={{ padding: 14 }}><p>Selecione os dois times na aba Análise pra ver a pontuação do confronto aqui.</p></div>;
  }

  async function favoritar() {
    setFavorEnviando(true);
    const jogo = horarioJogo ? { data: dataJogo, horario: horarioJogo } : null;
    const r = await window.favoritarIndice?.(data, idx, jogo);
    setFavorEnviando(false);
    if (!r || r.erro) window.toast?.(r?.erro ? `Erro ao favoritar: ${r.erro}` : 'Erro ao favoritar', true);
    else window.toast?.(horarioJogo ? 'Favoritado! Some sozinho 2h depois do início do jogo.' : 'Favoritado! Some sozinho em 2h.');
  }

  const { resultado, gols, btts } = idx;

  return (
    <div className="sec">
      <div className="sec-title" style={{ marginBottom: 10 }}><Gauge size={14} style={{ marginRight: 4 }} />Análise do Confronto — {data.casa} × {data.vis}</div>

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
      {!horarioJogo && <div style={{ fontSize: 9.5, color: 'var(--texto2)', marginTop: -6, marginBottom: 10 }}>Sem horário, o favorito some 2h depois de favoritado. Preenchendo, some 2h depois do início do jogo.</div>}

      {/* 🏆 RESULTADO */}
      {resultado ? (
        <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--texto2)', fontWeight: 700, marginBottom: 6 }}><Trophy size={13} /> RESULTADO</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: corClassificacao(resultado.classificacao) }}>{resultado.favorito || 'Equilibrado'}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ouro)' }}>{resultado.pontuacao}/100</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: corClassificacao(resultado.classificacao), marginBottom: resultado.alerta ? 8 : 0 }}>{resultado.classificacao}</div>
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

      {/* ⚽ GOLS — as 4 linhas, sempre */}
      <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--texto2)', fontWeight: 700, marginBottom: 6 }}><Goal size={13} /> GOLS</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: corClassificacao(gols.classificacao) }}>{gols.classificacao}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ouro)' }}>{gols.pontuacao}/100</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {gols.linhas.map((l) => (
            <div key={l.linha} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
              <span>Mais {l.linha}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--texto2)' }}>{l.prob}%</span>
                <span style={{ color: corClassificacao(l.classificacao), fontWeight: 700 }}>{l.classificacao}</span>
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
  );
}

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
      <AnaliseDoConfronto />
      <SecaoFavoritados />
    </div>
  );
}
