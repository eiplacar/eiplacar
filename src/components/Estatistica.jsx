import { useEffect, useMemo, useState } from 'react';
import { Trophy, Goal, Info, Search, LineChart, Ruler, Circle, FileText } from 'lucide-react';

// ══ Estatística (Ligas / Times) — oitavo módulo migrado para React ══
//
// Sub-aba "Ligas": estatística das entradas lançadas na Calculadora, agrupadas
// por Liga/Tipo/Mercado, mais a tabela de "minuto médio do gol que bate o Over"
// (calculada a partir dos jogos da Aba Dados).
// Sub-aba "Times": % de Over de Gols e Cantos por time, calculado a partir dos
// jogos já cadastrados.
//
// Toda a matemática continua sendo o mesmo JS puro de sempre — só virou função
// pura (sem tocar em DOM) em vez de escrever innerHTML direto:
//   - window.computeLigas(filtroTipo, filtroCamp)      → public/js/13-calculadora.js
//   - window.computeTempoGolTabela(camp)                → public/js/13-calculadora.js
//   - window.computeFutebolTimes(busca, camp, local)     → public/js/12-banca-futebol.js
//   - window.jogosCache / window.bpLoad() / window.gruposCampeonato / window.sortNatural
//
// Como os dados (jogosCache, banca) podem mudar em outra aba (ex: nova entrada
// na Calculadora), o componente recalcula toda vez que a aba é reaberta —
// window.estatisticaRefresh é o "sininho" chamado pelo goTo('futebol') do nav.

function CampeonatoOptions({ camps }) {
  const gruposCampeonato = window.gruposCampeonato || ((c) => c.map((x) => ({ base: x, itens: [x] })));
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const grupos = gruposCampeonato(camps);
  const comVariante = grupos.filter((g) => g.itens.length >= 2);
  const soltas = sortNatural(grupos.filter((g) => g.itens.length < 2).flatMap((g) => g.itens));
  return (
    <>
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
    </>
  );
}

function corPct(p) { return p >= 70 ? '#4dd87a' : p >= 50 ? 'var(--ouro)' : '#f08060'; }

export default function Estatistica() {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState('fligas');
  const [filtroLigaGlobal, setFiltroLigaGlobal] = useState('');
  const [filtroLigaTipo, setFiltroLigaTipo] = useState('');
  const [fTimeBusca, setFTimeBusca] = useState('');
  const [fTimeFiltroLiga, setFTimeFiltroLiga] = useState('');
  const [fTimeFiltroLocal, setFTimeFiltroLocal] = useState('');

  useEffect(() => {
    window.estatisticaRefresh = () => setTick((t) => t + 1);
    return () => { delete window.estatisticaRefresh; };
  }, []);

  const jogosCache = window.jogosCache || [];
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const camps = useMemo(() => sortNatural([...new Set(jogosCache.map((j) => j.camp))]), [jogosCache]);

  const linhasLigas = useMemo(
    () => (window.computeLigas ? window.computeLigas(filtroLigaTipo, filtroLigaGlobal) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtroLigaTipo, filtroLigaGlobal, jogosCache.length]
  );
  const linhasTempoGol = useMemo(
    () => (window.computeTempoGolTabela ? window.computeTempoGolTabela(filtroLigaGlobal) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtroLigaGlobal, jogosCache.length]
  );
  const times = useMemo(
    () => (window.computeFutebolTimes ? window.computeFutebolTimes(fTimeBusca, fTimeFiltroLiga, fTimeFiltroLocal) : { temJogosCadastrados: false, linhas: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fTimeBusca, fTimeFiltroLiga, fTimeFiltroLocal, jogosCache.length]
  );

  const linhasGolsLbl = ['O0,5', 'O1,5', 'O2,5', 'O3,5', 'O4,5'];
  const linhasCantosLbl = ['Cantos 7,5', 'Cantos 8,5', 'Cantos 9,5', 'Cantos 10,5'];

  return (
    <>
      <div className="sub-nav" style={{ marginBottom: 14 }}>
        <button className={`sub-tab ${tab === 'fligas' ? 'active' : ''}`} onClick={() => setTab('fligas')}><Trophy size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Ligas</button>
        <button className={`sub-tab ${tab === 'ftimes' ? 'active' : ''}`} onClick={() => setTab('ftimes')}><Goal size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Times</button>
      </div>

      {/* ═══ SUBPASTA LIGAS ═══ */}
      <div className={`sub-page ${tab === 'fligas' ? 'active' : ''}`}>
        <div className="sel-card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="sel-card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Campeonato</div>
            <button onClick={() => document.getElementById('modalInfoLigas')?.classList.add('open')} style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 7, padding: '5px 11px', color: 'var(--ouro)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Info size={12} /> Info</button>
          </div>
          <select value={filtroLigaGlobal} onChange={(e) => setFiltroLigaGlobal(e.target.value)}>
            <option value="">Todos os campeonatos</option>
            <CampeonatoOptions camps={camps} />
          </select>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>Filtra as duas tabelas abaixo de uma vez. Deixe em "Todos" pra ver tudo.</div>
        </div>

        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LineChart size={14} /> Estatística por Liga</div>
          <div className="filtros" style={{ marginBottom: 12 }}>
            <select value={filtroLigaTipo} onChange={(e) => setFiltroLigaTipo(e.target.value)}>
              <option value="">Pré-live + Live</option>
              <option value="prelive">📋 Só Pré-live</option>
              <option value="live">🔴 Só Live</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Liga</th><th>Tipo</th><th>Mercado</th><th>Minuto Médio</th><th>Odd Média</th><th>Entradas</th><th>Acertos</th></tr></thead>
              <tbody>
                {linhasLigas.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty"><div className="icon"><LineChart size={24} /></div><p>Nenhuma entrada com Liga e Mercado preenchidos ainda. Lance entradas na Calculadora informando esses campos.</p></div></td></tr>
                ) : linhasLigas.map((l, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--verde2)', fontWeight: 600 }}>{l.liga}</td>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{l.tipo === 'live' ? <><Circle size={9} fill="#f08060" color="#f08060" /> Live</> : <><FileText size={11} /> Pré-live</>}</td>
                    <td>{l.mercado}</td>
                    <td className="td-c">{l.minMedio != null ? l.minMedio + "'" : '—'}</td>
                    <td className="td-c">{l.oddMedia}</td>
                    <td className="td-c">{l.qtd}</td>
                    <td className="td-c" style={{ color: l.pctAcerto == null ? 'var(--texto2)' : l.pctAcerto >= 70 ? '#4dd87a' : l.pctAcerto >= 50 ? 'var(--ouro)' : '#f08060', fontWeight: 700 }}>
                      {l.pctAcerto != null ? l.pctAcerto + '%' : '—'} <span style={{ color: 'var(--texto2)', fontWeight: 400, fontSize: 10 }}>({l.greens}G/{l.reds}R)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ruler size={14} /> Minuto Médio do Gol que Bate o Over</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Liga</th><th>Mercado</th><th>Categoria</th><th>Média 1º Gol</th><th>Média Gol que Bateu</th><th>Jogos</th><th>% Jogos</th></tr></thead>
              <tbody>
                {linhasTempoGol.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty"><div className="icon"><Ruler size={22} /></div><p>Nenhum jogo com gols por minuto cadastrados bateu esses Overs ainda.</p></div></td></tr>
                ) : linhasTempoGol.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--verde2)', fontWeight: 600 }}>{r.liga}</td>
                    <td>Over {r.linha}</td>
                    <td>{r.rotuloTempo}</td>
                    <td className="td-c">{r.mediaPrimeiro}'</td>
                    <td className="td-c">{r.mediaBateu}'</td>
                    <td className="td-c">{r.qtd}</td>
                    <td className="td-c" style={{ color: r.pct >= 50 ? '#4dd87a' : r.pct >= 25 ? 'var(--ouro)' : '#f08060', fontWeight: 700 }}>{r.pct != null ? r.pct + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══ SUBPASTA TIMES ═══ */}
      <div className={`sub-page ${tab === 'ftimes' ? 'active' : ''}`}>
        <div className="sel-card" style={{ padding: '12px 16px' }}>
          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={13} /> Buscar Time</div>
          <input type="text" placeholder="Digite o nome do time..." value={fTimeBusca} onChange={(e) => setFTimeBusca(e.target.value)} style={{ marginBottom: 8 }} />
          <select value={fTimeFiltroLiga} onChange={(e) => setFTimeFiltroLiga(e.target.value)} style={{ marginBottom: 8 }}>
            <option value="">Todas as ligas</option>
            <CampeonatoOptions camps={camps} />
          </select>
          <select value={fTimeFiltroLocal} onChange={(e) => setFTimeFiltroLocal(e.target.value)}>
            <option value="">📊 Geral (casa + fora)</option>
            <option value="casa">🏠 Só como Mandante</option>
            <option value="fora">✈️ Só como Visitante</option>
          </select>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>Over de Gols: baseado nos gols que o próprio time marcou (não conta os gols do adversário). Over de Cantos: baseado no total de escanteios da partida (mandante + visitante), só nos jogos com esse dado cadastrado.</div>
        </div>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Goal size={14} /> Times — Over de Gols e Cantos</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th><th className="td-c">Jogos</th>
                  {linhasGolsLbl.map((l) => <th className="td-c" key={l}>{l}</th>)}
                  {linhasCantosLbl.map((l) => <th className="td-c" key={l}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {times.linhas.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--texto2)', padding: 16 }}>{times.temJogosCadastrados ? `Nenhum time com jogos ${fTimeFiltroLocal === 'casa' ? 'como mandante' : fTimeFiltroLocal === 'fora' ? 'como visitante' : 'cadastrados'} nesse filtro.` : 'Nenhum jogo cadastrado ainda na Aba Dados.'}</td></tr>
                ) : times.linhas.map((l) => (
                  <tr key={l.nome}>
                    <td><strong>{l.nome}</strong></td>
                    <td className="td-c" style={{ color: 'var(--texto2)' }}>{l.n}</td>
                    {l.pctGols.map((p, i) => <td className="td-c" key={i} style={{ color: corPct(p), fontWeight: 700 }}>{p}%</td>)}
                    {l.pctCantos.map((p, i) => <td className="td-c" key={i} style={p == null ? { color: 'var(--texto2)' } : { color: corPct(p), fontWeight: 700 }}>{p == null ? '—' : p + '%'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
