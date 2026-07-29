import { useEffect, useMemo, useState } from 'react';
import { Wallet, ShieldHalf, ShieldAlert, TrendingUp, ArrowDown, ArrowUp, ArrowDownCircle, ArrowUpCircle, ShieldPlus, Undo2, Trash2, ArrowLeftRight, BarChart3, Target, Lightbulb, Banknote, LineChart, CalendarDays, CalendarRange, Trophy, TrendingDown } from 'lucide-react';

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

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function mesLabelAtual() {
  const d = new Date();
  return `${MESES_PT[d.getMonth()]}/${d.getFullYear()}`;
}

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
    <div style={{ flex: 1, minWidth: 90, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '14px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: cor || 'var(--texto)' }}>{val}</div>
      <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase', marginTop: 4 }}>{lbl}</div>
    </div>
  );
}
function Grupo({ titulo, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.5px', marginBottom: 8 }}>{titulo}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

// Card de Depósitos/Retiradas: selo circular com a seta dentro (igual ao modelo),
// mas sem a barra/linha colorida embaixo — só o ícone, sem esse resquício do design antigo.
function StatBoxSeta({ icone: Icone, val, lbl, cor }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 10, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${cor}`, background: cor + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icone size={18} color={cor} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 700, marginBottom: 2 }}>{lbl}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--texto)' }}>{val}</div>
      </div>
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
      <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}><Wallet size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Saldo da Banca</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#4dd87a' }}>R$ {c.saldo.toFixed(2)}</div>
      </div>
      <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 12, padding: 14, textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}><ShieldHalf size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Reserva da Banca</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ouro)' }}>R$ {c.reserva.toFixed(2)}</div>
      </div>

      <Grupo titulo={<><ArrowLeftRight size={11} /> Depósitos / Retiradas</>}>
        <StatBoxSeta icone={ArrowDown} val={'R$ ' + c.depositos.toFixed(2)} lbl="Depósitos" cor="#4dd87a" />
        <StatBoxSeta icone={ArrowUp} val={'R$ ' + c.retiradas.toFixed(2)} lbl="Retiradas" cor="#f08060" />
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

  function abrir(tipo) { window.toastEsconder?.(); setAcao(tipo); setValor(''); setObs(''); setData(hoje()); }
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

function BarraProgresso({ pct, cor }) {
  return (
    <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, height: 10, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: cor, transition: 'width .3s' }} />
    </div>
  );
}

// Anel circular (donut) usado na "Taxa de acerto do dia"
function AnelProgresso({ pct, cor, tamanho = 56, espessura = 6 }) {
  const raio = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * raio;
  const offset = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div style={{ position: 'relative', width: tamanho, height: tamanho, flexShrink: 0 }}>
      <svg width={tamanho} height={tamanho} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke="var(--c1)" strokeWidth={espessura} />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke={cor} strokeWidth={espessura} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, color: cor }}>{pct}%</div>
    </div>
  );
}

// Linha de status (Stop Gain / Stop Loss) dentro do card "Controle de Stop"
function LinhaStop({ titulo, cor, atingido, valorLabel, valor, faltaLabel, falta }) {
  return (
    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--c3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0, boxShadow: atingido ? `0 0 6px ${cor}` : 'none' }} />
        <span style={{ fontSize: 11.5, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '.5px' }}>{titulo}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11.5, color: cor, fontWeight: 600 }}>{atingido ? 'Atingido' : 'Não atingido'}</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--texto2)' }}>{valorLabel}: <strong style={{ color: 'var(--texto)' }}>{valor}</strong></div>
          <div style={{ fontSize: 11, color: cor, fontWeight: 700 }}>{faltaLabel}: {falta}</div>
        </div>
      </div>
    </div>
  );
}

function GraficoLinha({ pontos, cor, titulo, badge, rodape, destaque }) {
  if (pontos.length < 2) return null;
  const w = 600, h = 140, pad = 10;
  const min = Math.min(...pontos), max = Math.max(...pontos);
  const range = (max - min) || 1;
  const stepX = (w - pad * 2) / (pontos.length - 1);
  const coords = pontos.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const linha = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
  const area = linha + ` L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>{titulo}</div>
        {badge && <span style={{ background: badge.cor + '22', color: badge.cor, fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{badge.texto}</span>}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <path d={area} fill={cor} opacity="0.12" />
        <path d={linha} fill="none" stroke={cor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {rodape && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          {rodape.map((rd, i) => (
            <div key={i} style={{ textAlign: i === 0 ? 'left' : (i === rodape.length - 1 ? 'right' : 'center') }}>
              <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{rd.label}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: rd.cor || 'var(--texto)' }}>{rd.valor}</div>
            </div>
          ))}
        </div>
      )}
      {destaque}
    </div>
  );
}

function AbaEvolucao() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const antigo = window.__bancaCarteiraTick;
    window.__bancaCarteiraTick = () => { antigo?.(); setTick((t) => t + 1); };
    return () => { window.__bancaCarteiraTick = antigo; };
  }, []);

  const ev = window.computeEvolucao ? window.computeEvolucao() : { pontosSaldo: [0], pontosReserva: [0], melhorSequencia: 0, piorSequencia: 0, maiorDrawdown: 0, crescimentoMensal: [] };
  const r = window.computeResumoBanca ? window.computeResumoBanca() : {
    metaDiaria: 0, stopGain: 0, stopLoss: 0,
    progressoMeta: 0, metaBatida: false, faltaMeta: 0,
    progressoStopGain: 0, stopGainAtingido: false, faltaStopGain: 0,
    progressoStopLoss: 0, stopLossAtingido: false, faltaStopLoss: 0,
    plHoje: 0, entradasHoje: 0, greensHoje: 0, redsHoje: 0, taxaAcertoHoje: 0,
    plMes: 0, entradasMes: 0, greensMes: 0, redsMes: 0, taxaAcertoMes: 0, roiMes: 0,
    maiorLucroDia: null, maiorPrejuizoDia: null,
  };

  // ── Evolução da Banca / Reserva: badges de variação % + rodapés ──
  const iniSaldo = ev.pontosSaldo[0], atualSaldo = ev.pontosSaldo[ev.pontosSaldo.length - 1];
  const pctSaldo = iniSaldo !== 0 ? ((atualSaldo - iniSaldo) / Math.abs(iniSaldo)) * 100 : (atualSaldo !== 0 ? 100 : 0);
  const iniReserva = ev.pontosReserva[0], atualReserva = ev.pontosReserva[ev.pontosReserva.length - 1];
  const pctReserva = iniReserva !== 0 ? ((atualReserva - iniReserva) / Math.abs(iniReserva)) * 100 : (atualReserva !== 0 ? 100 : 0);
  const pctProtegida = (atualSaldo + atualReserva) > 0 ? Math.round((atualReserva / (atualSaldo + atualReserva)) * 1000) / 10 : 0;

  return (
    <>
      <div className="grid2-resp">
        <GraficoLinha
          pontos={ev.pontosSaldo}
          cor={atualSaldo >= iniSaldo ? '#4dd87a' : '#f08060'}
          titulo={<span style={{ fontSize: 11 }}><TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Evolução da Banca</span>}
          badge={{ texto: `${pctSaldo >= 0 ? '↑' : '↓'} ${Math.abs(pctSaldo).toFixed(2)}%`, cor: atualSaldo >= iniSaldo ? '#4dd87a' : '#f08060' }}
          rodape={[
            { label: 'Início', valor: 'R$ ' + iniSaldo.toFixed(2) },
            { label: 'Lucro Total', valor: (atualSaldo - iniSaldo >= 0 ? '+' : '') + 'R$ ' + (atualSaldo - iniSaldo).toFixed(2), cor: atualSaldo >= iniSaldo ? '#4dd87a' : '#f08060' },
            { label: 'Atual', valor: 'R$ ' + atualSaldo.toFixed(2), cor: '#4dd87a' },
          ]}
        />
        <GraficoLinha
          pontos={ev.pontosReserva}
          cor="var(--ouro)"
          titulo={<span style={{ fontSize: 11 }}><ShieldHalf size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Evolução da Reserva</span>}
          badge={{ texto: `${pctReserva >= 0 ? '↑' : '↓'} ${Math.abs(pctReserva).toFixed(0)}%`, cor: 'var(--ouro)' }}
          rodape={[
            { label: 'Início', valor: 'R$ ' + iniReserva.toFixed(2) },
            { label: 'Atual', valor: 'R$ ' + atualReserva.toFixed(2), cor: 'var(--ouro)' },
          ]}
          destaque={
            <div style={{ marginTop: 10, background: 'rgba(255,196,0,.08)', border: '1px solid var(--ouro)', borderRadius: 8, padding: '9px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--ouro)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>% da Banca Protegida</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ouro)', marginTop: 2 }}>{pctProtegida}%</div>
            </div>
          }
        />
      </div>

      <div className="grid2-resp">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><Target size={13} color="#4dd87a" />Meta Diária</div>
          {r.metaDiaria > 0 ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase' }}>Lucro Atual</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: r.plHoje >= 0 ? '#4dd87a' : '#f08060' }}>{r.plHoje >= 0 ? '+' : ''}R$ {r.plHoje.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase' }}>Meta</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--texto)' }}>R$ {r.metaDiaria.toFixed(2)}</div>
                </div>
              </div>
              <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>Progresso</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><BarraProgresso pct={r.progressoMeta} cor="#4dd87a" /></div>
                <strong style={{ color: '#4dd87a', fontSize: 13 }}>{r.progressoMeta}%</strong>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: r.metaBatida ? '#4dd87a' : 'var(--texto2)' }}>
                {r.metaBatida ? '🎯 Meta do dia batida!' : `Falta R$ ${r.faltaMeta.toFixed(2)} para bater sua meta`}
              </div>
            </>
          ) : (
            <div className="empty"><div className="icon"><Target size={22} /></div><p>Configure em Conta → Configurações → Stop e Meta.</p></div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><ShieldAlert size={13} color="#f08060" />Controle de Stop</div>
          {(r.stopGain > 0 || r.stopLoss > 0) ? (
            <>
              {r.stopGain > 0 && (
                <LinhaStop titulo="Stop Gain" cor="#4dd87a" atingido={r.stopGainAtingido}
                  valorLabel="Meta" valor={'R$ ' + r.stopGain.toFixed(2)}
                  faltaLabel="Falta" falta={'R$ ' + r.faltaStopGain.toFixed(2)} />
              )}
              {r.stopLoss > 0 && (
                <div style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
                  <LinhaStop titulo="Stop Loss" cor="#f08060" atingido={r.stopLossAtingido}
                    valorLabel="Limite" valor={'-R$ ' + r.stopLoss.toFixed(2)}
                    faltaLabel="Falta" falta={'R$ ' + r.faltaStopLoss.toFixed(2)} />
                </div>
              )}
            </>
          ) : (
            <div className="empty"><div className="icon"><ShieldAlert size={22} /></div><p>Configure em Conta → Configurações → Stop e Meta.</p></div>
          )}
        </div>
      </div>

      <div className="grid2-resp">
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><CalendarDays size={13} />Resumo do Dia</div>
            <span style={{ fontSize: 10.5, color: 'var(--texto2)', fontWeight: 700 }}>Hoje</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <StatBox val={r.entradasHoje} lbl="Entradas" cor="#4d9dd8" />
            <StatBox val={r.greensHoje} lbl="Greens" cor="#4dd87a" />
            <StatBox val={r.redsHoje} lbl="Reds" cor="#f08060" />
            <StatBox val={(r.plHoje >= 0 ? '+' : '') + 'R$ ' + r.plHoje.toFixed(2)} lbl="P&L do Dia" cor={r.plHoje >= 0 ? '#4dd87a' : '#f08060'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--c3)' }}>
            <span style={{ fontSize: 11, color: 'var(--texto2)' }}>Taxa de acerto<br />do dia</span>
            <AnelProgresso pct={r.taxaAcertoHoje} cor="#4dd87a" />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><CalendarRange size={13} />Resumo do Mês</div>
            <span style={{ fontSize: 10.5, color: 'var(--texto2)', fontWeight: 700 }}>{mesLabelAtual()}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatBox val={(r.plMes >= 0 ? '+' : '') + 'R$ ' + r.plMes.toFixed(2)} lbl="Lucro" cor={r.plMes >= 0 ? '#4dd87a' : '#f08060'} />
            <StatBox val={(r.roiMes >= 0 ? '+' : '') + r.roiMes + '%'} lbl="ROI" cor={r.roiMes >= 0 ? '#4dd87a' : '#f08060'} />
            <StatBox val={r.taxaAcertoMes + '%'} lbl="Taxa de Acerto" />
            <StatBox val={r.entradasMes} lbl="Entradas" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={14} />Recordes</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatBox val={ev.melhorSequencia} lbl="Melhor Sequência · Greens" cor="#4dd87a" />
          <StatBox val={ev.piorSequencia} lbl="Pior Sequência · Reds" cor="#f08060" />
          <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#4dd87a' }}>{r.maiorLucroDia ? '+R$ ' + r.maiorLucroDia.valor.toFixed(2) : '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase', marginTop: 4 }}>Maior Lucro em um Dia</div>
            {r.maiorLucroDia && <div style={{ fontSize: 9, color: 'var(--texto2)', marginTop: 3 }}>{window.fd ? window.fd(r.maiorLucroDia.data) : r.maiorLucroDia.data}</div>}
          </div>
          <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f08060' }}>{r.maiorPrejuizoDia ? 'R$ ' + r.maiorPrejuizoDia.valor.toFixed(2) : '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--texto2)', textTransform: 'uppercase', marginTop: 4 }}>Maior Prejuízo em um Dia</div>
            {r.maiorPrejuizoDia && <div style={{ fontSize: 9, color: 'var(--texto2)', marginTop: 3 }}>{window.fd ? window.fd(r.maiorPrejuizoDia.data) : r.maiorPrejuizoDia.data}</div>}
          </div>
        </div>
      </div>

      <CrescimentoMensal dados={ev.crescimentoMensal} />
    </>
  );
}

// Crescimento Mensal — vem depois de Recordes. Mostra só os últimos meses por padrão
// (mais recente primeiro) e expande sob demanda, pra não virar uma lista enorme.
function CrescimentoMensal({ dados }) {
  const [expandido, setExpandido] = useState(false);
  const LIMITE = 6;
  const ordenados = [...dados].sort((a, b) => b.mes.localeCompare(a.mes)); // mais recente primeiro
  const visiveis = expandido ? ordenados : ordenados.slice(0, LIMITE);
  const temMais = ordenados.length > LIMITE;

  return (
    <div className="card">
      <div className="card-title">Crescimento Mensal</div>
      {ordenados.length === 0 ? (
        <div className="empty"><div className="icon"><LineChart size={22} /></div><p>Sem dados suficientes ainda.</p></div>
      ) : (
        <>
          {visiveis.map((m) => (
            <div key={m.mes} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--c3)' }}>
              <span style={{ color: 'var(--texto2)', fontSize: 12 }}>{m.mes}</span>
              <strong style={{ color: m.pl >= 0 ? '#4dd87a' : '#f08060' }}>{m.pl >= 0 ? '+' : ''}R$ {m.pl.toFixed(2)}</strong>
            </div>
          ))}
          {temMais && (
            <button
              onClick={() => setExpandido((v) => !v)}
              style={{ width: '100%', marginTop: 10, background: 'none', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px', color: 'var(--ouro)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {expandido ? 'Ver menos' : `Ver mais (${ordenados.length - LIMITE})`}
            </button>
          )}
        </>
      )}
    </div>
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
        <button className={`sub-tab ${tab === 'carteira' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('carteira'); }}><Wallet size={13} /><span>Carteira</span></button>
        <button className={`sub-tab ${tab === 'movimentacoes' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('movimentacoes'); }}><ArrowLeftRight size={13} /><span>Movimentações</span></button>
        <button className={`sub-tab ${tab === 'evolucao' ? 'active' : ''}`} onClick={() => { window.toastEsconder?.(); setTab('evolucao'); }}><TrendingUp size={13} /><span>Evolução</span></button>
      </div>

      <div className={`sub-page ${tab === 'carteira' ? 'active' : ''}`}><AbaCarteira /></div>
      <div className={`sub-page ${tab === 'movimentacoes' ? 'active' : ''}`}><AbaMovimentacoes /></div>
      <div className={`sub-page ${tab === 'evolucao' ? 'active' : ''}`}><AbaEvolucao /></div>
    </>
  );
}
