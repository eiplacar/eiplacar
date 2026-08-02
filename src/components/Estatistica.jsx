import { useEffect, useMemo, useState } from 'react';
import { Trophy, Goal, Search, LineChart } from 'lucide-react';

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
  const [fTimeBusca, setFTimeBusca] = useState('');
  const [fTimeFiltroLiga, setFTimeFiltroLiga] = useState('');
  const [fTimeFiltroLocal, setFTimeFiltroLocal] = useState('');
  const [fLigaBusca, setFLigaBusca] = useState('');
  const [mercadoLigas, setMercadoLigas] = useState('gols');
  const [mercadoTimes, setMercadoTimes] = useState('gols');

  useEffect(() => {
    window.estatisticaRefresh = () => setTick((t) => t + 1);
    return () => { delete window.estatisticaRefresh; };
  }, []);

  const jogosCache = window.jogosCache || [];
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const camps = useMemo(() => sortNatural([...new Set(jogosCache.map((j) => j.camp))]), [jogosCache]);

  const linhasLigasOver = useMemo(
    () => (window.computeFutebolLigas ? window.computeFutebolLigas(fLigaBusca, filtroLigaGlobal) : { temJogosCadastrados: false, linhas: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fLigaBusca, filtroLigaGlobal, jogosCache.length]
  );
  const times = useMemo(
    () => (window.computeFutebolTimes ? window.computeFutebolTimes(fTimeBusca, fTimeFiltroLiga, fTimeFiltroLocal) : { temJogosCadastrados: false, linhas: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fTimeBusca, fTimeFiltroLiga, fTimeFiltroLocal, jogosCache.length]
  );

  const linhasGolsLbl    = ['O0,5', 'O1,5', 'O2,5', 'O3,5', 'O4,5', 'Ambas Marcam'];
  const linhasCantosLbl  = ['C6,5', 'C7,5', 'C8,5', 'C9,5', 'C10,5', 'C11,5'];
  const linhasCartoesLbl = ['C1,5', 'C2,5', 'C3,5', 'C4,5', 'C5,5', 'C6,5'];

  // Botões de opção (mesmo padrão visual das chips de "Tipo de Aposta" na aba Apostas):
  // clicar troca qual mercado a tabela mostra — Gols, Escanteios ou Cartões, sem misturar.
  function BotoesMercado({ valor, onChange }) {
    const opcoes = [
      { id: 'gols', label: 'Gols' },
      { id: 'cantos', label: 'Escanteios' },
      { id: 'cartoes', label: 'Cartões' },
    ];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              flex: '0 0 auto', padding: '6px 16px', borderRadius: 20,
              border: `1px solid ${valor === o.id ? 'var(--verde2)' : 'var(--c3)'}`,
              background: valor === o.id ? 'rgba(37,163,82,.15)' : 'var(--c1)',
              color: valor === o.id ? 'var(--verde2)' : 'var(--texto2)',
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  function colunasPor(mercado) {
    if (mercado === 'cantos') return linhasCantosLbl;
    if (mercado === 'cartoes') return linhasCartoesLbl;
    return linhasGolsLbl;
  }
  function valoresPor(mercado, linha) {
    if (mercado === 'cantos') return linha.pctCantos;
    if (mercado === 'cartoes') return linha.pctCartoes;
    return [...linha.pctGols, linha.pctBTTS];
  }

  return (
    <>
      <div className="sub-nav" style={{ marginBottom: 14 }}>
        <button className={`sub-tab ${tab === 'fligas' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('fligas'); }}><Trophy size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Ligas</button>
        <button className={`sub-tab ${tab === 'ftimes' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('ftimes'); }}><Goal size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Times</button>
      </div>

      {/* ═══ SUBPASTA LIGAS ═══ */}
      <div className={`sub-page ${tab === 'fligas' ? 'active' : ''}`}>
        <div className="sel-card" style={{ padding: '12px 16px' }}>
          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={13} /> Buscar Liga</div>
          <input type="text" placeholder="Digite o nome da liga..." value={fLigaBusca} onChange={(e) => setFLigaBusca(e.target.value)} style={{ marginBottom: 8 }} />
          <select value={filtroLigaGlobal} onChange={(e) => setFiltroLigaGlobal(e.target.value)}>
            <option value="">Todos os campeonatos</option>
            <CampeonatoOptions camps={camps.filter((c) => c.toLowerCase().includes(fLigaBusca.toLowerCase()))} />
          </select>
        </div>

        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LineChart size={14} /> Ligas — Over de Gols, Escanteios e Cartões</div>
          <BotoesMercado valor={mercadoLigas} onChange={setMercadoLigas} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Liga</th><th className="td-c">Jogos</th>
                  {colunasPor(mercadoLigas).map((l) => <th className="td-c" key={l}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {linhasLigasOver.linhas.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--texto2)', padding: 16 }}>{linhasLigasOver.temJogosCadastrados ? 'Nenhuma liga encontrada nesse filtro.' : 'Nenhum jogo cadastrado ainda.'}</td></tr>
                ) : linhasLigasOver.linhas.map((l) => (
                  <tr key={l.nome}>
                    <td style={{ color: 'var(--verde2)', fontWeight: 600 }}>{l.nome}</td>
                    <td className="td-c" style={{ color: 'var(--texto2)' }}>{l.n}</td>
                    {valoresPor(mercadoLigas, l).map((p, i) => <td className="td-c" key={i} style={p == null ? { color: 'var(--texto2)' } : { color: corPct(p), fontWeight: 700 }}>{p == null ? '—' : p + '%'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>
            {mercadoLigas === 'gols' && 'Over de Gols: baseado no total de gols da partida (mandante + visitante). Ambas Marcam: os dois times balançaram as redes.'}
            {mercadoLigas === 'cantos' && 'Over de Escanteios: baseado no total de escanteios da partida, só nos jogos com esse dado cadastrado.'}
            {mercadoLigas === 'cartoes' && 'Over de Cartões: soma de amarelos e vermelhos dos dois times na partida, só nos jogos com esse dado cadastrado.'}
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
            <option value="">Geral (casa + fora)</option>
            <option value="casa">Só como Mandante</option>
            <option value="fora">Só como Visitante</option>
          </select>
        </div>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Goal size={14} /> Times — Over de Gols, Escanteios e Cartões</div>
          <BotoesMercado valor={mercadoTimes} onChange={setMercadoTimes} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th><th className="td-c">Jogos</th>
                  {colunasPor(mercadoTimes).map((l) => <th className="td-c" key={l}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {times.linhas.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--texto2)', padding: 16 }}>{times.temJogosCadastrados ? `Nenhum time com jogos ${fTimeFiltroLocal === 'casa' ? 'como mandante' : fTimeFiltroLocal === 'fora' ? 'como visitante' : 'cadastrados'} nesse filtro.` : 'Nenhum jogo cadastrado ainda.'}</td></tr>
                ) : times.linhas.map((l) => (
                  <tr key={l.nome}>
                    <td><strong>{l.nome}</strong></td>
                    <td className="td-c" style={{ color: 'var(--texto2)' }}>{l.n}</td>
                    {valoresPor(mercadoTimes, l).map((p, i) => <td className="td-c" key={i} style={p == null ? { color: 'var(--texto2)' } : { color: corPct(p), fontWeight: 700 }}>{p == null ? '—' : p + '%'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>
            {mercadoTimes === 'gols' && 'Over de Gols: baseado nos gols que o próprio time marcou.'}
            {mercadoTimes === 'cantos' && 'Over de Escanteios: baseado no total de escanteios da partida (mandante + visitante).'}
            {mercadoTimes === 'cartoes' && 'Over de Cartões: soma de amarelos e vermelhos dos dois times na partida.'}
          </div>
        </div>
      </div>
    </>
  );
}
