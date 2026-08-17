import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Target, ShieldHalf, CalendarRange, Trophy, Goal, Clock, History, Timer, Layers, Home, Plane, LayoutGrid, ShieldCheck, Award, ChevronDown, X, Check, ShieldQuestion, Users, Shield } from 'lucide-react';

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
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const especiais = window.comEspeciaisPorUltimo;
  const lista = especiais ? especiais(sortNatural(camps)) : sortNatural(camps);
  return lista.map((c) => <option key={c} value={c}>{c}</option>);
}

function corPct(p) { return p == null ? 'var(--texto2)' : p >= 50 ? 'var(--verde2)' : p >= 25 ? 'var(--ouro)' : 'var(--perigo)'; }

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
// Faixas de classificação do Score — usadas tanto no rótulo abaixo do card
// quanto desenhadas dentro do próprio gauge.
const FAIXAS_SCORE = [
  { min: 0, max: 20, nome: 'Muito Fraco', cor: '#f0554b' },
  { min: 21, max: 40, nome: 'Fraco', cor: '#f0a83c' },
  { min: 41, max: 60, nome: 'Neutro', cor: '#e0d83c' },
  { min: 61, max: 80, nome: 'Favorável', cor: '#8bd84d' },
  { min: 81, max: 100, nome: 'Excelente', cor: 'var(--verde2)' },
];

function ScoreGauge({ score }) {
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const cx = 80, cy = 78, r = 62, espessura = 13;
  const toRad = (a) => (a * Math.PI) / 180;
  const ponto = (a, raio) => [cx + raio * Math.cos(toRad(a)), cy + raio * Math.sin(toRad(a))];
  const arco = (a0, a1, raio) => {
    const [x0, y0] = ponto(a0, raio), [x1, y1] = ponto(a1, raio);
    const largeArc = a1 - a0 <= 180 ? 0 : 1;
    return `M ${x0} ${y0} A ${raio} ${raio} 0 ${largeArc} 1 ${x1} ${y1}`;
  };
  const angulo = -180 + pct * 180;
  const anguloRad = 0.05; // folguinha entre as faixas
  return (
    <svg viewBox="0 0 160 88" width="150" height="82">
      {FAIXAS_SCORE.map((faixa, i) => {
        const a0 = -180 + (faixa.min / 100) * 180 + (i === 0 ? 0 : anguloRad * 40);
        const a1 = -180 + (faixa.max / 100) * 180 - (i === FAIXAS_SCORE.length - 1 ? 0 : anguloRad * 40);
        const meio = (a0 + a1) / 2;
        const [lx, ly] = ponto(meio, r - 17.5);
        return (
          <g key={faixa.nome}>
            <path d={arco(a0, a1, r)} stroke={faixa.cor} strokeWidth={espessura} fill="none" strokeLinecap="round" opacity={score >= faixa.min && score <= faixa.max ? 1 : 0.38} />
            <text x={lx} y={ly + 2} textAnchor="middle" fontSize="5.6" fontWeight="700" fill={faixa.cor}>{faixa.nome}</text>
          </g>
        );
      })}
      {/* agulha indicando o score atual */}
      <line x1={cx} y1={cy} x2={ponto(angulo, r + 7)[0]} y2={ponto(angulo, r + 7)[1]} stroke="var(--branco)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill="var(--branco)" />
    </svg>
  );
}

// Barra de progresso de um critério do Score (0 a 20 pts)
function CriterioBar({ label, valor }) {
  const pct = Math.max(0, Math.min(100, (valor / 20) * 100));
  const cor = pct >= 75 ? 'var(--verde2)' : pct >= 50 ? '#c9d84d' : pct >= 25 ? '#e0a53c' : 'var(--perigo)';
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

// Card circular clicável (Liga/Mercado/Mandante/Visitante) — ícone/escudo dentro
// de um anel colorido, com o valor selecionado embaixo. Abre o formulário de
// Filtros Avançados ao ser tocado.
function FiltroCard({ label, icon, valor, corAnel, onClick }) {
  return (
    <button type="button" onClick={onClick} className="sel-card" style={{ padding: '14px 4px 12px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--texto2)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${corAnel}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
        {icon}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, color: valor ? 'var(--branco)' : 'var(--texto2)' }}>
        {valor || 'Selecione'}
      </div>
    </button>
  );
}

// Stat com legenda embaixo (ex: "Taxa de confirmação", "Minuto médio") — usado
// na fileira de 4 estatísticas da aba Equipes.
function StatCard({ icon, valor, label, caption, cor }) {
  return (
    <div className="sel-card" style={{ padding: '10px 4px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, minHeight: 22 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 17, fontWeight: 800, color: cor || 'var(--branco)', marginBottom: 4 }}>
        {icon} {valor}
      </div>
      <div style={{ fontSize: 9, color: 'var(--texto2)' }}>{caption}</div>
    </div>
  );
}

// Barra de progresso simples do % de confirmação do cenário (substitui as
// antigas "barrinhas de evolução" — mais direto de ler.
function BarraProgressoCenario({ pct }) {
  if (pct == null) {
    return <div style={{ height: 22, fontSize: 9, color: 'var(--texto2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Sem histórico suficiente</div>;
  }
  const cor = pct >= 50 ? 'var(--verde2)' : pct >= 25 ? 'var(--ouro)' : 'var(--perigo)';
  return (
    <div style={{ background: 'var(--fundo3, #1c2426)', borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${pct}%`, background: cor, height: '100%', borderRadius: 4 }} />
    </div>
  );
}

// Escudo do time (se já foi cadastrado na Aba Dados/Confrontos) ou um ícone
// genérico de escudo enquanto não tem nada salvo pra esse nome.
function EscudoImg({ nome, size = 26 }) {
  const url = window.getEscudo ? window.getEscudo(nome) : null;
  // margin: '0 auto' é o que de fato centraliza — sendo display:block, o
  // text-align:center do <th> pai não tem efeito nenhum sobre ele sozinho.
  if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain', display: 'block', margin: '0 auto' }} />;
  return <ShieldQuestion size={size * 0.7} color="var(--texto2)" style={{ display: 'block', margin: '0 auto' }} />;
}

// Bottom-sheet com a lista de opções (usado pelos seletores de Mandante/Visitante dentro do formulário de Filtros Avançados).
function SeletorSheet({ titulo, opcoes, valorAtual, onSelecionar, onFechar }) {
  const [busca, setBusca] = useState('');
  const filtradas = busca ? opcoes.filter((o) => o.label.toLowerCase().includes(busca.toLowerCase())) : opcoes;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={onFechar}>
      <div style={{ background: 'var(--fundo2, #12181a)', width: '100%', maxHeight: '78vh', borderRadius: '16px 16px 0 0', padding: '14px 16px 20px', overflowY: 'auto', borderTop: '1px solid var(--borda, #232b2d)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{titulo}</div>
          <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', color: 'var(--texto2)', padding: 4 }}><X size={20} /></button>
        </div>
        {opcoes.length > 8 && (
          <input autoFocus placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
        )}
        <div>
          {filtradas.map((o) => (
            <div key={o.value} onClick={() => { onSelecionar(o.value); onFechar(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px', borderBottom: '1px solid var(--borda, #1e2628)', cursor: 'pointer', borderRadius: 6, background: o.value === valorAtual ? 'rgba(77,216,122,0.08)' : 'transparent' }}>
              {o.icon}
              <span style={{ flex: 1, fontSize: 13.5 }}>{o.label}</span>
              {o.value === valorAtual && <Check size={16} color="var(--verde2)" />}
            </div>
          ))}
          {!filtradas.length && <div style={{ textAlign: 'center', color: 'var(--texto2)', padding: 20, fontSize: 13 }}>Nada encontrado.</div>}
        </div>
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
  const [linhaE, setLinhaE] = useState(1.5); // número (Over X.5) ou 'btts' (Ambas Marcam)
  const [mandanteE, setMandanteE] = useState('');
  const [visitanteE, setVisitanteE] = useState('');
  const [limiteE, setLimiteE] = useState(20);
  const [modoMandanteE, setModoMandanteE] = useState('ambas'); // 'ambas'|'casa'|'fora' — jogos considerados do Mandante
  const [modoVisitanteE, setModoVisitanteE] = useState('ambas'); // 'ambas'|'casa'|'fora' — jogos considerados do Visitante
  const [sheetAberto, setSheetAberto] = useState(null); // 'liga'|'mercado'|'mandante'|'visitante'|null
  // Cenários da aba Equipes: sempre 2, editados via Filtros Avançados (placar e minuto por select).
  const [cenariosE, setCenariosE] = useState([
    { id: 1, placar: '0x0', minuto: 30 },
    { id: 2, placar: '1x0', minuto: 45 },
  ]);

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
      cenarios: cenariosE.map((c) => ({ placar: c.placar, minuto: c.minuto })),
      modoMandante: modoMandanteE, modoVisitante: modoVisitanteE,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campE, linhaE, mandanteE, visitanteE, limiteE, cenariosE, modoMandanteE, modoVisitanteE, jogosCache.length]);

  const mercadoLabel = linhaE === 'btts' ? 'Ambas Marcam' : `Over ${linhaE}`;

  function atualizarCenario(id, campo, valor) {
    setCenariosE((lista) => lista.map((c) => c.id === id ? { ...c, [campo]: valor } : c));
  }

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
        </div>

        <TabelaFaixa linhas={faixa} />
      </div>

      {/* ═══ SUBPASTA EQUIPES ═══ */}
      <div className={`sub-page ${tab === 'eequipes' ? 'active' : ''}`}>

        {/* Liga / Mercado / Mandante / Visitante — cada card abre o seu próprio seletor.
            "Liga" concentra Liga + Últimos Jogos + Mandante Joga + Visitante Joga + Cenários. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <FiltroCard label="Liga" corAnel="var(--verde2)" valor={campE || 'Todas'}
            icon={<Trophy size={22} color="var(--verde2)" />}
            onClick={() => setSheetAberto('liga')} />
          <FiltroCard label="Mercado" corAnel="var(--ouro)" valor={mercadoLabel}
            icon={<Goal size={22} color="var(--ouro)" />}
            onClick={() => setSheetAberto('mercado')} />
          <FiltroCard label="Mandante" corAnel="var(--verde2)" valor={mandanteE}
            icon={mandanteE ? <EscudoImg nome={mandanteE} size={36} /> : <Home size={20} color="var(--texto2)" />}
            onClick={() => setSheetAberto('mandante')} />
          <FiltroCard label="Visitante" corAnel="#e05a5a" valor={visitanteE}
            icon={visitanteE ? <EscudoImg nome={visitanteE} size={36} /> : <Plane size={20} color="var(--texto2)" />}
            onClick={() => setSheetAberto('visitante')} />
        </div>

        {!mandanteE || !visitanteE ? (
          <div className="card">
            <div className="empty">
              <div className="icon"><ShieldHalf size={24} /></div>
              <p>Escolha um Mandante e um Visitante nos cards acima pra calcular o Score da Estratégia.</p>
            </div>
          </div>
        ) : !resultado ? (
          <div className="card">
            <div className="empty">
              <div className="icon"><ShieldHalf size={24} /></div>
              <p>Sem jogos suficientes desses dois times ainda.</p>
            </div>
          </div>
        ) : (
          <>
            {/* SCORE DA ESTRATÉGIA */}
            <div className="card" style={{ border: `1px solid ${resultado.score >= 61 ? 'var(--verde2)' : 'var(--ouro)'}`, background: 'rgba(77,216,122,0.04)' }}>
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

            {/* Mercado / Média 1º Gol / Média Confirmação / Jogos Analisados */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, margin: '10px 0' }}>
              <StatCard icon={<TrendingUp size={15} />} valor={resultado.tendencia.pctConfirmacao != null ? resultado.tendencia.pctConfirmacao + '%' : '—'} label={mercadoLabel} caption="Taxa de confirmação" cor={corPct(resultado.tendencia.pctConfirmacao)} />
              <StatCard icon={<Clock size={15} color="var(--verde2)" />} valor={resultado.tendencia.mediaPrimeiroGol != null ? resultado.tendencia.mediaPrimeiroGol + "'" : '—'} label="Média 1º Gol" caption="Minuto médio" />
              <StatCard icon={<Clock size={15} color="var(--ouro)" />} valor={resultado.tendencia.mediaConfirmacao != null ? resultado.tendencia.mediaConfirmacao + "'" : '—'} label="Média Confirmação" caption="Minuto médio" />
              <StatCard icon={<LayoutGrid size={15} color="#5fa8f5" />} valor={resultado.tendencia.jogos} label="Jogos Analisados" caption="Jogos" />
            </div>

            {/* CENÁRIOS DE ENTRADA (2, definidos nos Filtros Avançados — sem botão de adicionar aqui) */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Timer size={14} /> Cenários de Entrada</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {cenariosE.map((c, i) => {
                  const dado = resultado.cenarios[i] || { pct: null, jogos: 0 };
                  return (
                    <div key={c.id} className="sel-card" style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{c.placar} aos {c.minuto}'</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: corPct(dado.pct) }}>{dado.pct != null ? dado.pct + '%' : '—'}</div>
                      {/* Quebra sempre nas mesmas 2 linhas — não deixa o navegador decidir
                          onde cortar, senão um card quebra "torto" (94 numa linha, jogos)
                          na outra) enquanto o outro cabe tudo numa linha só. */}
                      <div style={{ fontSize: 9.5, color: 'var(--texto2)', marginBottom: 6, lineHeight: 1.4 }}>
                        <div>Confirmaram {mercadoLabel}</div>
                        <div>({dado.confirmou ?? '—'}/{dado.jogos} jogos)</div>
                      </div>
                      <BarraProgressoCenario pct={dado.pct} />
                    </div>
                  );
                })}
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
                <table className="tabela-comparativo">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th className="td-c" title={mandanteE}>
                        <EscudoImg nome={mandanteE} size={24} />
                        <div className="th-nome-time">{mandanteE}</div>
                      </th>
                      <th className="td-c" title={visitanteE}>
                        <EscudoImg nome={visitanteE} size={24} />
                        <div className="th-nome-time">{visitanteE}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{mercadoLabel}</td>
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
                      <td>Ambas Marcam</td>
                      <td className="td-c">{resultado.comparativo.mandante?.pctAmbasMarcam ?? '—'}%</td>
                      <td className="td-c">{resultado.comparativo.visitante?.pctAmbasMarcam ?? '—'}%</td>
                    </tr>
                    <tr>
                      <td>Média 1º Gol</td>
                      <td className="td-c">{resultado.comparativo.mandante?.avgMinPrimeiroGol != null ? Math.round(resultado.comparativo.mandante.avgMinPrimeiroGol) + "'" : '—'}</td>
                      <td className="td-c">{resultado.comparativo.visitante?.avgMinPrimeiroGol != null ? Math.round(resultado.comparativo.visitante.avgMinPrimeiroGol) + "'" : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: 'var(--texto2)', marginTop: 8 }}>
                Dados baseados {limiteE ? `nos últimos ${limiteE} jogos` : 'na temporada inteira'} de cada equipe{campE ? ` na ${campE}` : ''}.
                {modoMandanteE !== 'ambas' && ` ${mandanteE} considerando só jogos ${modoMandanteE === 'casa' ? 'em casa' : 'fora'}.`}
                {modoVisitanteE !== 'ambas' && ` ${visitanteE} considerando só jogos ${modoVisitanteE === 'casa' ? 'em casa' : 'fora'}.`}
              </div>
            </div>
          </>
        )}

        {/* Card "Liga" — concentra Liga, Últimos Jogos, Mandante Joga, Visitante Joga e os 2 Cenários de Entrada */}
        {sheetAberto === 'liga' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={() => setSheetAberto(null)}>
            <div style={{ background: 'var(--fundo2, #12181a)', width: '100%', maxHeight: '88vh', borderRadius: '16px 16px 0 0', padding: '14px 16px 20px', overflowY: 'auto', borderTop: '1px solid var(--borda, #232b2d)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14 }}><Trophy size={15} color="var(--verde2)" /> Liga</div>
                <button type="button" onClick={() => setSheetAberto(null)} style={{ background: 'none', border: 'none', color: 'var(--texto2)', padding: 4 }}><X size={20} /></button>
              </div>

              <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Liga</div>
              <select value={campE} onChange={(e) => setCampE(e.target.value)} style={{ marginBottom: 10 }}>
                <option value="">Todos os campeonatos</option>
                <CampeonatoOptions camps={camps} />
              </select>

              <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarRange size={13} /> Últimos Jogos</div>
              <select value={limiteE} onChange={(e) => setLimiteE(Number(e.target.value))} style={{ marginBottom: 10 }}>
                <option value={5}>Últimos 5 jogos</option>
                <option value={10}>Últimos 10 jogos</option>
                <option value={20}>Últimos 20 jogos</option>
                <option value={0}>Temporada (todos os jogos)</option>
              </select>

              <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={13} /> Mandante Joga</div>
              <select value={modoMandanteE} onChange={(e) => setModoMandanteE(e.target.value)} style={{ marginBottom: 10 }}>
                <option value="ambas">Ambas (casa e fora)</option>
                <option value="casa">Só em Casa</option>
                <option value="fora">Só Fora</option>
              </select>

              <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={13} /> Visitante Joga</div>
              <select value={modoVisitanteE} onChange={(e) => setModoVisitanteE(e.target.value)} style={{ marginBottom: 10 }}>
                <option value="ambas">Ambas (casa e fora)</option>
                <option value="casa">Só em Casa</option>
                <option value="fora">Só Fora</option>
              </select>

              <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Target size={13} /> Cenários de Entrada</div>
              <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 8 }}>Escolha o placar e o minuto de cada cenário — pode ser no 1º ou no 2º tempo.</div>
              {cenariosE.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--texto2)', width: 58, flexShrink: 0 }}>Cenário {i + 1}</span>
                  <select value={c.placar} onChange={(e) => atualizarCenario(c.id, 'placar', e.target.value)} style={{ flex: 1 }}>
                    {PLACARES_CENARIO.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <span style={{ fontSize: 12, color: 'var(--texto2)' }}>aos</span>
                  <select value={c.minuto} onChange={(e) => atualizarCenario(c.id, 'minuto', Number(e.target.value))} style={{ width: 84 }}>
                    {MINUTOS_CENARIO.map((m) => <option key={m} value={m}>{m}'</option>)}
                  </select>
                </div>
              ))}

              <button type="button" onClick={() => setSheetAberto(null)} className="btn-primary" style={{ width: '100%', padding: '10px', marginTop: 8 }}>Aplicar</button>
            </div>
          </div>
        )}

        {/* Card "Mercado" */}
        {sheetAberto === 'mercado' && (
          <SeletorSheet titulo="Escolha o Mercado" valorAtual={linhaE} onFechar={() => setSheetAberto(null)}
            onSelecionar={(v) => setLinhaE(v === 'btts' ? 'btts' : Number(v))}
            opcoes={[
              { value: 1.5, label: 'Over 1.5', icon: <Goal size={16} color="var(--ouro)" /> },
              { value: 2.5, label: 'Over 2.5', icon: <Goal size={16} color="var(--ouro)" /> },
              { value: 3.5, label: 'Over 3.5', icon: <Goal size={16} color="var(--ouro)" /> },
              { value: 4.5, label: 'Over 4.5', icon: <Goal size={16} color="var(--ouro)" /> },
              { value: 'btts', label: 'Ambas Marcam', icon: <Goal size={16} color="var(--ouro)" /> },
            ]} />
        )}

        {/* Card "Mandante" e "Visitante" — lista de times */}
        {sheetAberto === 'mandante' && (
          <SeletorSheet titulo="Escolha o Mandante" valorAtual={mandanteE} onFechar={() => setSheetAberto(null)}
            onSelecionar={setMandanteE}
            opcoes={times.filter((t) => t !== visitanteE).map((t) => ({ value: t, label: t, icon: <EscudoImg nome={t} size={22} /> }))} />
        )}
        {sheetAberto === 'visitante' && (
          <SeletorSheet titulo="Escolha o Visitante" valorAtual={visitanteE} onFechar={() => setSheetAberto(null)}
            onSelecionar={setVisitanteE}
            opcoes={times.filter((t) => t !== mandanteE).map((t) => ({ value: t, label: t, icon: <EscudoImg nome={t} size={22} /> }))} />
        )}
      </div>
    </>
  );
}
