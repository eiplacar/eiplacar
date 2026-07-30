import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Target, ShieldHalf, CalendarRange, Trophy, Goal, Clock, History, Timer, Layers } from 'lucide-react';

// ══ Estratégias — 3 sub-abas: Linha do Tempo / Cenários / Equipes ══
//
// "Linha do Tempo": tabelas "Janela de Entrada" (1º Tempo e 2º Tempo) — mostram
// em média em que minuto sai o 1º gol e em que minuto sai o "gol da confirmação"
// (o gol que bate a linha do Over escolhido), por Liga e Mercado. Filtráveis por
// Liga, Mercado e "últimos N jogos" da liga.
//
// Toda a base de cálculo vem dos jogos já cadastrados na ABA DADOS (jogosCache,
// com os gols e o minuto de cada um) — window.computeJanelaEntrada(), definida
// em public/js/13-calculadora.js. "Cenários" e "Equipes" ainda não têm conteúdo
// definido, ficam com placeholder por enquanto.
//
// Como jogosCache pode mudar em outra aba (novo jogo cadastrado na Aba Dados),
// o componente recalcula toda vez que a aba é reaberta — window.estrategiasRefresh
// é o "sininho" chamado pelo goTo('estrategias') do nav (public/js/03-nav.js).

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

function corPct(p) { return p == null ? 'var(--texto2)' : p >= 50 ? '#4dd87a' : p >= 25 ? 'var(--ouro)' : '#f08060'; }

function TabelaJanela({ titulo, icon, linhas }) {
  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {titulo}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Liga</th><th>Mercado</th>
              <th className="td-c">1º Gol (Média)</th>
              <th className="td-c">Gol da Confirmação</th>
              <th className="td-c">Jogos</th>
              <th className="td-c">%</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--texto2)', padding: 16 }}>Nenhum jogo com gols por minuto cadastrados bateu esse filtro ainda.</td></tr>
            ) : linhas.map((l, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--verde2)', fontWeight: 600 }}>{l.liga}</td>
                <td>{l.mercado}</td>
                <td className="td-c">{l.mediaPrimeiro}'</td>
                <td className="td-c">{l.mediaBateu}'</td>
                <td className="td-c">{l.qtd}</td>
                <td className="td-c" style={{ color: corPct(l.pct), fontWeight: 700 }}>{l.pct != null ? l.pct + '%' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaFaixa({ linhas }) {
  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={14} /> Faixa de Confirmação</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Liga</th><th>Mercado</th><th>Cenário</th>
              <th className="td-c">Jogos</th>
              <th className="td-c">Confirmou</th>
              <th className="td-c">%</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--texto2)', padding: 16 }}>Nenhum jogo com cronologia de gols completa bateu esse cenário ainda.</td></tr>
            ) : linhas.map((l, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--verde2)', fontWeight: 600 }}>{l.liga}</td>
                <td>{l.mercado}</td>
                <td style={{ color: 'var(--texto2)' }}>{l.cenario}</td>
                <td className="td-c">{l.jogos}</td>
                <td className="td-c">{l.confirmou}</td>
                <td className="td-c" style={{ color: corPct(l.pct), fontWeight: 700 }}>{l.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MINUTOS_CENARIO = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
const PLACARES_CENARIO = ['0x0', '1x0', '0x1', '1x1', '2x0', '0x2', '2x1', '1x2', '2x2', '3x1', '1x3'];

export default function Estrategias() {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState('elinha');
  const [limite, setLimite] = useState(0);
  const [camp, setCamp] = useState('');
  const [mercadoLinha, setMercadoLinha] = useState('');
  const [campC, setCampC] = useState('');
  const [limiteC, setLimiteC] = useState(0);
  const [minutoC, setMinutoC] = useState(30);
  const [placarC, setPlacarC] = useState('0x0');

  useEffect(() => {
    window.estrategiasRefresh = () => setTick((t) => t + 1);
    return () => { delete window.estrategiasRefresh; };
  }, []);

  const jogosCache = window.jogosCache || [];
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const camps = useMemo(() => sortNatural([...new Set(jogosCache.map((j) => j.camp))]), [jogosCache]);

  const janela = useMemo(
    () => (window.computeJanelaEntrada ? window.computeJanelaEntrada({ camp, mercadoLinha, limite }) : { t1: [], t2: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camp, mercadoLinha, limite, jogosCache.length]
  );

  const faixa = useMemo(
    () => (window.computeFaixaConfirmacao ? window.computeFaixaConfirmacao({ camp: campC, limite: limiteC, minuto: minutoC, placar: placarC }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campC, limiteC, minutoC, placarC, jogosCache.length]
  );

  return (
    <>
      <div className="sub-nav" style={{ marginBottom: 14 }}>
        <button className={`sub-tab ${tab === 'elinha' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('elinha'); }}><TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Linha do Tempo</button>
        <button className={`sub-tab ${tab === 'ecenarios' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('ecenarios'); }}><Target size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Cenários</button>
        <button className={`sub-tab ${tab === 'eequipes' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('eequipes'); }}><ShieldHalf size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Equipes</button>
      </div>

      {/* ═══ SUBPASTA LINHA DO TEMPO ═══ */}
      <div className={`sub-page ${tab === 'elinha' ? 'active' : ''}`}>
        <div className="sel-card" style={{ padding: '12px 16px' }}>
          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarRange size={13} /> Últimos Jogos</div>
          <select value={limite} onChange={(e) => setLimite(Number(e.target.value))} style={{ marginBottom: 8 }}>
            <option value={0}>Temporada (todos os jogos)</option>
            <option value={5}>Últimos 5 jogos</option>
            <option value={10}>Últimos 10 jogos</option>
            <option value={20}>Últimos 20 jogos</option>
          </select>

          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Liga</div>
          <select value={camp} onChange={(e) => setCamp(e.target.value)} style={{ marginBottom: 8 }}>
            <option value="">Todos os campeonatos</option>
            <CampeonatoOptions camps={camps} />
          </select>

          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Goal size={13} /> Mercado</div>
          <select value={mercadoLinha} onChange={(e) => setMercadoLinha(e.target.value)}>
            <option value="">Todos os mercados</option>
            <option value="1.5">Over 1.5</option>
            <option value="2.5">Over 2.5</option>
            <option value="3.5">Over 3.5</option>
            <option value="4.5">Over 4.5</option>
            <option value="btts">Ambas Marcam</option>
          </select>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>Calculado a partir dos jogos e gols por minuto cadastrados na Aba Dados. "Últimos N jogos" filtra por liga, do mais recente pro mais antigo.</div>
        </div>

        <TabelaJanela titulo="Janela de Entrada — 1º Tempo" icon={<Clock size={14} />} linhas={janela.t1} />
        <TabelaJanela titulo="Janela de Entrada — 2º Tempo" icon={<History size={14} />} linhas={janela.t2} />
      </div>

      {/* ═══ SUBPASTA CENÁRIOS ═══ */}
      <div className={`sub-page ${tab === 'ecenarios' ? 'active' : ''}`}>
        <div className="sel-card" style={{ padding: '12px 16px' }}>
          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Liga</div>
          <select value={campC} onChange={(e) => setCampC(e.target.value)} style={{ marginBottom: 8 }}>
            <option value="">Todos os campeonatos</option>
            <CampeonatoOptions camps={camps} />
          </select>

          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarRange size={13} /> Temporada</div>
          <select value={limiteC} onChange={(e) => setLimiteC(Number(e.target.value))} style={{ marginBottom: 8 }}>
            <option value={0}>Temporada (todos os jogos)</option>
            <option value={10}>Últimos 10 jogos</option>
            <option value={20}>Últimos 20 jogos</option>
          </select>

          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Timer size={13} /> Minuto</div>
          <select value={minutoC} onChange={(e) => setMinutoC(Number(e.target.value))} style={{ marginBottom: 8 }}>
            {MINUTOS_CENARIO.map((m) => <option key={m} value={m}>Até {m}'</option>)}
          </select>

          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={13} /> Placar</div>
          <select value={placarC} onChange={(e) => setPlacarC(e.target.value)}>
            {PLACARES_CENARIO.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 6 }}>Mostra, entre os jogos que chegaram nesse placar até esse minuto, quantos % confirmaram cada linha de Over até o fim. Só entram jogos com a cronologia de gols completa (Aba Dados).</div>
        </div>

        <TabelaFaixa linhas={faixa} />
      </div>

      {/* ═══ SUBPASTA EQUIPES ═══ */}
      <div className={`sub-page ${tab === 'eequipes' ? 'active' : ''}`}>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldHalf size={14} /> Equipes</div>
          <div className="empty">
            <div className="icon"><ShieldHalf size={24} /></div>
            <p>Em breve, análise por equipes por aqui.</p>
          </div>
        </div>
      </div>
    </>
  );
}
