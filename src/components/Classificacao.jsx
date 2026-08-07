import { useEffect, useMemo, useState } from 'react';
import { Trophy, BarChart3 } from 'lucide-react';

// ══ Classificação — nono módulo migrado para React ══
//
// Tabela calculada a partir dos jogos da Aba Dados: usa o Ranking já informado
// em cada jogo (posição real da liga) e, onde faltar, cai pro cálculo por
// pontos (3 vitória / 1 empate) como apoio/fallback. Cópa do Mundo e
// Amistosos não têm classificação (mata-mata/sem tabela).
//
// A matemática continua a mesma de sempre, só virou função pura sem DOM:
//   - window.computeClassificacao(camp) → public/js/12-banca-futebol.js
//   - window.jogosCache / window.sortNatural / window.comEspeciaisPorUltimo
//
// window.classificacaoRefresh é o "sininho" chamado pelo goTo('classificacao')
// do nav sempre que a aba é reaberta (os jogos podem ter mudado noutra aba).

function CampeonatoOptions({ camps }) {
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const especiais = window.comEspeciaisPorUltimo;
  const lista = especiais ? especiais(sortNatural(camps)) : sortNatural(camps);
  return lista.map((c) => <option key={c} value={c}>{c}</option>);
}

export default function Classificacao() {
  const [, setTick] = useState(0);
  const [camp, setCamp] = useState('');
  const [modo, setModo] = useState('geral'); // 'geral' | 'casa' | 'visitante'

  useEffect(() => {
    window.classificacaoRefresh = () => setTick((t) => t + 1);
    return () => { delete window.classificacaoRefresh; };
  }, []);

  const jogosCache = window.jogosCache || [];
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const camps = useMemo(
    () => sortNatural([...new Set(jogosCache.map((j) => j.camp))]).filter((c) => !/copa do mundo|amistoso/i.test(c)),
    // jogosVersion muda em toda edição/adição/remoção — inclusive quando só o CONTEÚDO de
    // um jogo já existente muda (ex.: corrigir o placar), que não altera jogosCache.length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jogosCache.length, window.jogosVersion]
  );

  // Se o campeonato escolhido não existe mais na lista (ou nada foi escolhido ainda), cai no primeiro
  const campAtivo = camps.includes(camp) ? camp : (camps[0] || '');

  const data = useMemo(
    () => (window.computeClassificacao ? window.computeClassificacao(campAtivo, modo) : { estado: 'sem-jogos' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campAtivo, modo, jogosCache.length, window.jogosVersion]
  );

  return (
    <>
      <div className="sel-card" style={{ padding: '12px 16px' }}>
        <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Liga</div>
        <select value={campAtivo} onChange={(e) => setCamp(e.target.value)} style={{ marginBottom: 10 }}>
          {camps.length === 0
            ? <option value="">Nenhum campeonato com classificação ainda</option>
            : <CampeonatoOptions camps={camps} />}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`local-btn ${modo === 'geral' ? 'active-all' : ''}`} onClick={() => setModo('geral')} style={{ flex: 1, padding: '7px 4px', fontSize: 12 }}>Geral</button>
          <button className={`local-btn ${modo === 'casa' ? 'active-casa' : ''}`} onClick={() => setModo('casa')} style={{ flex: 1, padding: '7px 4px', fontSize: 12 }}>Em casa</button>
          <button className={`local-btn ${modo === 'visitante' ? 'active-fora' : ''}`} onClick={() => setModo('visitante')} style={{ flex: 1, padding: '7px 4px', fontSize: 12 }}>Visitante</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={14} /> Tabela</div>
        {modo !== 'geral' && data.estado === 'ok' && (
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 8 }}>
            Só jogos {modo === 'casa' ? 'como mandante' : 'como visitante'} — posição calculada por pontos, não é a posição oficial da temporada.
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pos</th><th>Time</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th></tr></thead>
            <tbody>
              {data.estado === 'sem-classificacao' && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--texto2)', padding: 16 }}>{campAtivo} não tem classificação (mata-mata/amistoso).</td></tr>
              )}
              {(data.estado === 'sem-jogos' || data.estado === 'sem-jogos-liga') && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--texto2)', padding: 16 }}>{jogosCache.length ? 'Nenhum jogo dessa liga ainda.' : 'Nenhum jogo cadastrado ainda.'}</td></tr>
              )}
              {data.estado === 'ok' && data.linhas.map((l) => (
                <tr key={l.nome}>
                  <td style={l.zona ? { boxShadow: `inset 4px 0 0 0 ${l.zona.cor}` } : undefined} title={l.zona ? l.zona.label : ''}>{l.rank ?? '—'}</td>
                  <td style={{ textAlign: 'left' }}>{l.nome}</td>
                  <td><strong>{l.pts}</strong></td>
                  <td>{l.j}</td>
                  <td>{l.v}</td>
                  <td>{l.e}</td>
                  <td>{l.d}</td>
                  <td>{l.gp}</td>
                  <td>{l.gc}</td>
                  <td style={{ color: l.sg >= 0 ? 'var(--verde2)' : 'var(--perigo)' }}>{l.sg >= 0 ? '+' : ''}{l.sg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.estado === 'ok' && data.zonas && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--c3)' }}>
            {data.zonas.map((z) => (
              <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--texto2)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: z.cor, flexShrink: 0 }} />
                <span>{z.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
