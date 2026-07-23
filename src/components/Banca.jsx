import { useEffect, useMemo, useState } from 'react';
import { Wallet, ShieldHalf, TrendingUp, ArrowDownCircle, ArrowUpCircle, ShieldPlus, Undo2, Trash2, ArrowLeftRight, BarChart3, Target, Lightbulb, Banknote, LineChart } from 'lucide-react';

// ══ Banca (carteira individual) — 10º módulo migrado/redesenhado em React ══
//
// Antes a Banca era um "pool" compartilhado (participantes + organizador +
// tesouraria, com distribuição proporcional de lucro). Agora é uma carteira só:
// Saldo da Carteira + Reserva de proteção, alimentados por Depósitos/Retiradas/
// Transferências e pelo resultado das entradas lançadas na Calculadora.
//
// Pontes com o JS puro (public/js/14-banca-gestao.js):
//   - window.computeCarteira()               → resumo (saldo, reserva, P&L, ROI, taxa de acerto...)
//   - window.computeEvolucao()                → série histórica + melhor sequência/maior drawdown
//   - window.bancaMovimentar(tipo,valor,data,obs) → Depositar/Retirar/Carteira→Reserva/Reserva→Carteira
//   - window.bancaExcluirMovimento(id)
// window.bancaRefresh é o "sininho" chamado pelo goTo('banca') e sempre que uma
// entrada é lançada/editada/excluída na Calculadora (o saldo pode ter mudado).

const hoje = () => new Date().toISOString().split('T')[0];

function rotuloDia(dataStr) {
  if (!dataStr) return '—';
  const d = dataStr, h = hoje();
  const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (d === h) return 'Hoje';
  if (d === ontem) return 'Ontem';
  return window.fd ? window.fd(d) : d;
}

const ROTULOS_MOV = {
  deposito: { label: 'Depósito', icone: ArrowDownCircle, cor: '#4dd87a', sinal: '+' },
  retirada: { label: 'Retirada', icone: ArrowUpCircle, cor: '#f08060', sinal: '-' },
  carteira_reserva: { label: 'Carteira → Reserva', icone: ShieldPlus, cor: 'var(--ouro)', sinal: '-' },
  reserva_carteira: { label: 'Reserva → Carteira', icone: Undo2, cor: 'var(--ouro)', sinal: '+' },
};

function StatBox({ val, lbl, cor }) {
  return (
    <div style={{ flex: 1, minWidth: 90, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: cor || 'var(--texto)' }}>{val}</div>
      <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase', marginTop: 2 }}>{lbl}</div>
    </div>
  );
}
function Grupo({ titulo, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.5px', marginBottom: 6 }}>{titulo}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function AbaCarteira() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const off = () => setTick((t) => t + 1);
    window.__bancaCarteiraTick = off;
    return () => { delete window.__bancaCarteiraTick; };
  }, []);
  const c = window.computeCarteira ? window.computeCarteira() : { saldo: 0, reserva: 0, depositos: 0, retiradas: 0, pl: 0, roi: 0, taxaAcerto: 0, entradas: 0, greens: 0, reds: 0, stakeRecomendada: [] };

  return (
    <>
      <div style={{ background: 'rgba(37,163,82,.15)', border: '2px solid var(--verde2)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}><Wallet size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Saldo da Banca</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#4dd87a' }}>R$ {c.saldo.toFixed(2)}</div>
      </div>
      <div style={{ background: 'var(--c2)', border: '1.5px solid var(--ouro)', borderRadius: 12, padding: 14, textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}><ShieldHalf size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Reserva da Banca</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ouro)' }}>R$ {c.reserva.toFixed(2)}</div>
      </div>

      <Grupo titulo={<><ArrowLeftRight size={11} /> Depósitos / Retiradas</>}>
        <StatBox val={'R$ ' + c.depositos.toFixed(2)} lbl="Depósitos" />
        <StatBox val={'R$ ' + c.retiradas.toFixed(2)} lbl="Retiradas" />
      </Grupo>

      <Grupo titulo={<><BarChart3 size={11} /> Performance</>}>
        <StatBox val={(c.pl >= 0 ? '+' : '') + 'R$ ' + c.pl.toFixed(2)} lbl="P&L" cor={c.pl >= 0 ? '#4dd87a' : '#f08060'} />
        <StatBox val={(c.roi >= 0 ? '+' : '') + c.roi + '%'} lbl="ROI" cor={c.roi >= 0 ? '#4dd87a' : '#f08060'} />
        <StatBox val={c.taxaAcerto + '%'} lbl="Taxa de Acerto" />
      </Grupo>

      <Grupo titulo={<><Target size={11} /> Atividade</>}>
        <StatBox val={c.entradas} lbl="Entradas" />
        <StatBox val={c.greens} lbl="Greens" cor="#4dd87a" />
        <StatBox val={c.reds} lbl="Reds" cor="#f08060" />
      </Grupo>

      <Grupo titulo={<><Lightbulb size={11} /> Stake Recomendada</>}>
        {c.stakeRecomendada.map((s) => (
          <StatBox key={s.pct} val={'R$ ' + s.valor.toFixed(2)} lbl={s.pct + '%'} cor="var(--ouro)" />
        ))}
      </Grupo>
    </>
  );
}

function AbaMovimentacoes() {
  const [, setTick] = useState(0);
  const [acao, setAcao] = useState(null);
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [data, setData] = useState(hoje());

  useEffect(() => {
    window.bancaMovTick = () => setTick((t) => t + 1);
    return () => { delete window.bancaMovTick; };
  }, []);

  const c = window.computeCarteira ? window.computeCarteira() : { saldo: 0, reserva: 0 };
  const d = window.bpLoad ? window.bpLoad() : { movimentos: [] };
  const movimentos = d.movimentos || [];

  function abrir(tipo) { setAcao(tipo); setValor(''); setObs(''); setData(hoje()); }
  function fechar() { setAcao(null); }

  function confirmar() {
    const r = window.bancaMovimentar(acao, valor, data, obs);
    if (!r.ok) { window.toast?.('⚠️ ' + r.msg, true); return; }
    window.toast?.('✅ Movimentação registrada');
    fechar();
    setTick((t) => t + 1);
    window.__bancaCarteiraTick?.();
  }

  function excluir(id) {
    if (!confirm('Excluir esta movimentação? O saldo/reserva volta ao valor anterior.')) return;
    window.bancaExcluirMovimento(id);
    setTick((t) => t + 1);
    window.__bancaCarteiraTick?.();
  }

  // Agrupa por dia (mais recente primeiro — movimentos já vêm nessa ordem)
  const porDia = [];
  movimentos.forEach((m) => {
    let grupo = porDia.find((g) => g.data === m.data);
    if (!grupo) { grupo = { data: m.data, itens: [] }; porDia.push(grupo); }
    grupo.itens.push(m);
  });

  const acoes = [
    { tipo: 'deposito', label: 'Depositar', icone: ArrowDownCircle, cor: '#4dd87a' },
    { tipo: 'retirada', label: 'Retirar', icone: ArrowUpCircle, cor: '#f08060' },
    { tipo: 'carteira_reserva', label: 'Carteira → Reserva', icone: ShieldPlus, cor: 'var(--ouro)' },
    { tipo: 'reserva_carteira', label: 'Reserva → Carteira', icone: Undo2, cor: 'var(--ouro)' },
  ];

  return (
    <>
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {acoes.map((a) => (
            <button key={a.tipo} onClick={() => abrir(a.tipo)} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '10px 8px', color: a.cor, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              <a.icone size={15} />{a.label}
            </button>
          ))}
        </div>

        {acao && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--c3)' }}>
            <div className="card-title" style={{ marginBottom: 10 }}>{ROTULOS_MOV[acao].label}</div>
            {(acao === 'carteira_reserva' || acao === 'reserva_carteira') && (
              <div style={{ fontSize: 11, color: 'var(--texto2)', marginBottom: 10 }}>
                Saldo {acao === 'carteira_reserva' ? 'da Carteira' : 'da Reserva'}: <strong style={{ color: 'var(--ouro)' }}>R$ {(acao === 'carteira_reserva' ? c.saldo : c.reserva).toFixed(2)}</strong>
              </div>
            )}
            <div className="fg fg2">
              <div><label>Valor (R$)</label><input type="number" min="0.01" step="0.01" placeholder="0.00" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
              <div><label>Data</label><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label>Observação (opcional)</label><input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: prêmio do mês" /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={confirmar}>Salvar</button>
              <button onClick={fechar} style={{ background: 'none', border: '1px solid var(--c3)', borderRadius: 8, padding: '0 16px', color: 'var(--texto2)', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Histórico</div>
        {porDia.length === 0 ? (
          <div className="empty"><div className="icon"><Banknote size={22} /></div><p>Nenhuma movimentação ainda.</p></div>
        ) : porDia.map((g) => (
          <div key={g.data} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--texto2)', marginBottom: 6 }}>{rotuloDia(g.data)}</div>
            {g.itens.map((m) => {
              const r = ROTULOS_MOV[m.tipo];
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--c3)' }}>
                  <r.icone size={16} color={r.cor} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                    {m.obs && <div style={{ fontSize: 10, color: 'var(--texto2)' }}>{m.obs}</div>}
                  </div>
                  <div style={{ fontWeight: 800, color: r.cor }}>{r.sinal} R$ {m.valor.toFixed(2)}</div>
                  <button onClick={() => excluir(m.id)} className="btn-danger" style={{ padding: '3px 7px', fontSize: 11 }}><Trash2 size={12} /></button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function GraficoLinha({ pontos, cor, titulo }) {
  if (pontos.length < 2) return null;
  const w = 600, h = 140, pad = 10;
  const min = Math.min(...pontos), max = Math.max(...pontos);
  const range = (max - min) || 1;
  const stepX = (w - pad * 2) / (pontos.length - 1);
  const coords = pontos.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const linha = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
  const area = linha + ` L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <div className="card">
      <div className="card-title">{titulo}</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <path d={area} fill={cor} opacity="0.12" />
        <path d={linha} fill="none" stroke={cor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--texto2)', marginTop: 4 }}>
        <span>Início: R$ {pontos[0].toFixed(2)}</span>
        <span>Atual: R$ {pontos[pontos.length - 1].toFixed(2)}</span>
      </div>
    </div>
  );
}

function AbaEvolucao() {
  const ev = window.computeEvolucao ? window.computeEvolucao() : { pontosSaldo: [0], pontosReserva: [0], melhorSequencia: 0, maiorDrawdown: 0, crescimentoMensal: [] };
  return (
    <>
      <GraficoLinha pontos={ev.pontosSaldo} cor={ev.pontosSaldo[ev.pontosSaldo.length - 1] >= ev.pontosSaldo[0] ? '#4dd87a' : '#f08060'} titulo={<span><TrendingUp size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Evolução da Banca</span>} />
      <GraficoLinha pontos={ev.pontosReserva} cor="var(--ouro)" titulo={<span><ShieldHalf size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Evolução da Reserva</span>} />

      <div className="card">
        <div className="card-title">Crescimento Mensal</div>
        {ev.crescimentoMensal.length === 0 ? (
          <div className="empty"><div className="icon"><LineChart size={22} /></div><p>Sem dados suficientes ainda.</p></div>
        ) : ev.crescimentoMensal.map((m) => (
          <div key={m.mes} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--c3)' }}>
            <span style={{ color: 'var(--texto2)', fontSize: 12 }}>{m.mes}</span>
            <strong style={{ color: m.pl >= 0 ? '#4dd87a' : '#f08060' }}>{m.pl >= 0 ? '+' : ''}R$ {m.pl.toFixed(2)}</strong>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Recordes</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatBox val={ev.melhorSequencia} lbl="Melhor Sequência" cor="#4dd87a" />
          <StatBox val={'R$ ' + ev.maiorDrawdown.toFixed(2)} lbl="Maior Drawdown" cor="#f08060" />
        </div>
      </div>
    </>
  );
}

export default function Banca() {
  const [tab, setTab] = useState('carteira');
  const [, setTick] = useState(0);

  useEffect(() => {
    window.bancaRefresh = () => { setTick((t) => t + 1); window.__bancaCarteiraTick?.(); window.bancaMovTick?.(); };
    return () => { delete window.bancaRefresh; };
  }, []);

  return (
    <>
      <div className="sub-nav" style={{ marginBottom: 14 }}>
        <button className={`sub-tab ${tab === 'carteira' ? 'active' : ''}`} onClick={() => setTab('carteira')}><Wallet size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Carteira</button>
        <button className={`sub-tab ${tab === 'movimentacoes' ? 'active' : ''}`} onClick={() => setTab('movimentacoes')}><ArrowLeftRight size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Movimentações</button>
        <button className={`sub-tab ${tab === 'evolucao' ? 'active' : ''}`} onClick={() => setTab('evolucao')}><TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Evolução</button>
      </div>

      <div className={`sub-page ${tab === 'carteira' ? 'active' : ''}`}><AbaCarteira /></div>
      <div className={`sub-page ${tab === 'movimentacoes' ? 'active' : ''}`}><AbaMovimentacoes /></div>
      <div className={`sub-page ${tab === 'evolucao' ? 'active' : ''}`}><AbaEvolucao /></div>
    </>
  );
}
