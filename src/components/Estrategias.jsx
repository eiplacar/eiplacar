import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Target, ShieldHalf, CalendarRange, Trophy, Goal, Clock, History, Timer, Layers, Home, Plane, LayoutGrid, ShieldCheck, Award } from 'lucide-react';

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

// Meio-círculo (gauge) do Score, 0-100. Cor muda por faixa: vermelho→ouro→verde.
function ScoreGauge({ score }) {
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const cx = 70, cy = 66, r = 54;
  const toRad = (a) => (a * Math.PI) / 180;
  const ponto = (a) => [cx + r * Math.cos(toRad(a)), cy + r * Math.sin(toRad(a))];
  const arco = (a0, a1) => {
    const [x0, y0] = ponto(a0), [x1, y1] = ponto(a1);
    const largeArc = a1 - a0 <= 180 ? 0 : 1;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
  };
  const angulo = -180 + pct * 180;
  const cor = score >= 75 ? '#4dd87a' : score >= 55 ? '#c9d84d' : score >= 35 ? '#e0a53c' : '#f08060';
  return (
    <svg viewBox="0 0 140 74" width="128" height="68">
      <path d={arco(-180, 0)} stroke="#2a3436" strokeWidth="11" fill="none" strokeLinecap="round" />
      {pct > 0 && <path d={arco(-180, angulo)} stroke={cor} strokeWidth="11" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

// Barra de progresso de um critério do Score (0 a 20 pts)
function CriterioBar({ label, valor }) {
  const pct = Math.max(0, Math.min(100, (valor / 20) * 100));
  const cor = pct >= 75 ? '#4dd87a' : pct >= 50 ? '#c9d84d' : pct >= 25 ? '#e0a53c' : '#f08060';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--texto2)' }}>{label}</span>
        <span style={{ fontWeight: 700, color: cor }}>{valor.toFixed(1)}/20</span>
      </div>
      <div style={{ background: 'var(--fundo3, #1c2426)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: cor, height: '100%', borderRadius: 4 }} />
      </div>
    </div>
  );
}

function StatMini({ icon, valor, label, cor }) {
  return (
    <div className="sel-card" style={{ padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 20, fontWeight: 800, color: cor || 'var(--branco)' }}>
        {icon} {valor}
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
  const [campE, setCampE] = useState('');
  const [linhaE, setLinhaE] = useState(1.5);
  const [mandanteE, setMandanteE] = useState('');
  const [visitanteE, setVisitanteE] = useState('');
  const [limiteE, setLimiteE] = useState(20);
  const [minZerado, setMinZerado] = useState(30);
  const [minVantagem, setMinVantagem] = useState(35);
  const [minEmpate, setMinEmpate] = useState(45);

  useEffect(() => {
    window.estrategiasRefresh = () => setTick((t) => t + 1);
    return () => { delete window.estrategiasRefresh; };
  }, []);

  useEffect(() => { setMandanteE(''); setVisitanteE(''); }, [campE]);

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

  const times = useMemo(() => {
    const jogos = campE ? jogosCache.filter((j) => j.camp === campE) : jogosCache;
    return sortNatural([...new Set(jogos.flatMap((j) => [j.casa, j.vis]))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campE, jogosCache.length]);

  const resultado = useMemo(() => {
    if (!mandanteE || !visitanteE || !window.computeScoreEstrategia) return null;
    return window.computeScoreEstrategia({
      camp: campE, limite: limiteE || 0, linha: linhaE, mandante: mandanteE, visitante: visitanteE,
      cenarios: [
        { placar: '0x0', minuto: minZerado, tipo: 'Zerado' },
        { placar: '1x0', minuto: minVantagem, tipo: 'Vantagem' },
        { placar: '1x1', minuto: minEmpate, tipo: 'Empate' },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campE, linhaE, mandanteE, visitanteE, limiteE, minZerado, minVantagem, minEmpate, jogosCache.length]);

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div className="sel-card" style={{ padding: '10px 12px' }}>
            <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Liga</div>
            <select value={campE} onChange={(e) => setCampE(e.target.value)}>
              <option value="">Todos os campeonatos</option>
              <CampeonatoOptions camps={camps} />
            </select>
          </div>
          <div className="sel-card" style={{ padding: '10px 12px' }}>
            <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Goal size={13} /> Mercado</div>
            <select value={linhaE} onChange={(e) => setLinhaE(Number(e.target.value))}>
              <option value={1.5}>Over 1.5</option>
              <option value={2.5}>Over 2.5</option>
              <option value={3.5}>Over 3.5</option>
              <option value={4.5}>Over 4.5</option>
            </select>
          </div>
          <div className="sel-card" style={{ padding: '10px 12px' }}>
            <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Home size={13} /> Mandante</div>
            <select value={mandanteE} onChange={(e) => setMandanteE(e.target.value)}>
              <option value="">Selecione</option>
              {times.filter((t) => t !== visitanteE).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sel-card" style={{ padding: '10px 12px' }}>
            <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plane size={13} /> Visitante</div>
            <select value={visitanteE} onChange={(e) => setVisitanteE(e.target.value)}>
              <option value="">Selecione</option>
              {times.filter((t) => t !== mandanteE).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="sel-card" style={{ padding: '10px 12px', marginBottom: 10 }}>
          <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarRange size={13} /> Últimos Jogos</div>
          <select value={limiteE} onChange={(e) => setLimiteE(Number(e.target.value))}>
            <option value={5}>Últimos 5 jogos</option>
            <option value={10}>Últimos 10 jogos</option>
            <option value={20}>Últimos 20 jogos</option>
            <option value={0}>Temporada (todos os jogos)</option>
          </select>
        </div>

        {!mandanteE || !visitanteE ? (
          <div className="card">
            <div className="empty">
              <div className="icon"><ShieldHalf size={24} /></div>
              <p>Escolha um Mandante e um Visitante pra calcular o Score da Estratégia.</p>
            </div>
          </div>
        ) : !resultado ? (
          <div className="card">
            <div className="empty">
              <div className="icon"><ShieldHalf size={24} /></div>
              <p>Sem jogos suficientes desses dois times na Aba Dados ainda.</p>
            </div>
          </div>
        ) : (
          <>
            {/* SCORE DA ESTRATÉGIA */}
            <div className="card" style={{ border: `1px solid ${resultado.score >= 55 ? 'var(--verde2)' : 'var(--ouro)'}`, background: 'rgba(77,216,122,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ShieldCheck size={34} color="var(--verde2)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Score da Estratégia</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--verde2)' }}>{resultado.score}</span>
                    <span style={{ fontSize: 15, color: 'var(--texto2)' }}>/100</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--verde2)', fontWeight: 600 }}>{resultado.classificacao}</div>
                </div>
                <ScoreGauge score={resultado.score} />
              </div>
            </div>

            {/* STATS RÁPIDAS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '10px 0' }}>
              <StatMini icon={<TrendingUp size={16} />} valor={resultado.tendencia.pctConfirmacao != null ? resultado.tendencia.pctConfirmacao + '%' : '—'} label={`Over ${linhaE}`} cor={corPct(resultado.tendencia.pctConfirmacao)} />
              <StatMini icon={<Clock size={16} color="var(--verde2)" />} valor={resultado.tendencia.mediaPrimeiroGol != null ? resultado.tendencia.mediaPrimeiroGol + "'" : '—'} label="Média 1º Gol" />
              <StatMini icon={<Clock size={16} color="var(--ouro)" />} valor={resultado.tendencia.mediaConfirmacao != null ? resultado.tendencia.mediaConfirmacao + "'" : '—'} label="Média Confirmação" />
              <StatMini icon={<LayoutGrid size={16} color="#5fa8f5" />} valor={resultado.tendencia.jogos} label="Jogos Analisados" />
            </div>

            {/* CENÁRIOS (ENTRADA NO 1º TEMPO) */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Timer size={14} /> Cenários (Entrada no 1º Tempo)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { rotulo: 'Zerado', placar: '0x0', min: minZerado, set: setMinZerado, dado: resultado.cenarios[0] },
                  { rotulo: 'Vantagem', placar: '1x0', min: minVantagem, set: setMinVantagem, dado: resultado.cenarios[1] },
                  { rotulo: 'Empate', placar: '1x1', min: minEmpate, set: setMinEmpate, dado: resultado.cenarios[2] },
                ].map((c) => (
                  <div key={c.rotulo} className="sel-card" style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 4 }}>{c.rotulo}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      {c.placar} aos
                      <input type="number" min={1} max={90} value={c.min} onChange={(e) => c.set(Number(e.target.value) || 1)} style={{ width: 42, padding: '2px 4px', textAlign: 'center' }} />'
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: corPct(c.dado.pct) }}>{c.dado.pct != null ? c.dado.pct + '%' : '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--texto2)' }}>Confirmaram Over {linhaE} ({c.dado.jogos} jogos)</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CRITÉRIOS DO SCORE */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Award size={14} /> Critérios do Score</div>
              <CriterioBar label="Força da Equipe" valor={resultado.criterios.forca} />
              <CriterioBar label="Ataque" valor={resultado.criterios.ataque} />
              <CriterioBar label="Momento" valor={resultado.criterios.momento} />
              <CriterioBar label="Comportamento" valor={resultado.criterios.comportamento} />
              <CriterioBar label="Tendência do Mercado" valor={resultado.criterios.tendencia} />
            </div>

            {/* COMPARATIVO ENTRE AS EQUIPES */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldHalf size={14} /> Comparativo entre as Equipes</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Estatística</th><th className="td-c">{mandanteE}</th><th className="td-c">{visitanteE}</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Over {linhaE}</td>
                      <td className="td-c" style={{ color: corPct(resultado.comparativo.mandante?.pctOverLinha), fontWeight: 700 }}>{resultado.comparativo.mandante?.pctOverLinha ?? '—'}%</td>
                      <td className="td-c" style={{ color: corPct(resultado.comparativo.visitante?.pctOverLinha), fontWeight: 700 }}>{resultado.comparativo.visitante?.pctOverLinha ?? '—'}%</td>
                    </tr>
                    <tr>
                      <td>Marca no 2º Tempo</td>
                      <td className="td-c">{resultado.comparativo.mandante?.pctMarca2T ?? '—'}%</td>
                      <td className="td-c">{resultado.comparativo.visitante?.pctMarca2T ?? '—'}%</td>
                    </tr>
                    <tr>
                      <td>Sofre no 2º Tempo</td>
                      <td className="td-c">{resultado.comparativo.mandante?.pctSofre2T ?? '—'}%</td>
                      <td className="td-c">{resultado.comparativo.visitante?.pctSofre2T ?? '—'}%</td>
                    </tr>
                    <tr>
                      <td>Média 1º Gol</td>
                      <td className="td-c">{resultado.comparativo.mandante?.avgMinPrimeiroGol != null ? Math.round(resultado.comparativo.mandante.avgMinPrimeiroGol) + "'" : '—'}</td>
                      <td className="td-c">{resultado.comparativo.visitante?.avgMinPrimeiroGol != null ? Math.round(resultado.comparativo.visitante.avgMinPrimeiroGol) + "'" : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 8 }}>Dados baseados {limiteE ? `nos últimos ${limiteE} jogos` : 'na temporada inteira'} de cada equipe{campE ? ` na ${campE}` : ''}.</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
