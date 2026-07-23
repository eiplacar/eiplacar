import { useState } from 'react';
import { BarChart3, Download, CheckCircle2, XCircle, AlertTriangle, Plus, X } from 'lucide-react';

// ══ Calculadora de EV — primeiro módulo migrado para React ══
//
// Mesma lógica de antes, visual simplificado (menos blocos grandes, menos
// repetição, cores só pra sinalizar positivo/negativo/alerta).
//
// Pontes com o restante do app, que ainda é JS puro:
//   - window.ultimaAnalise  → preenchido pela aba Análise ao calcular
//   - window.toast(msg)     → aviso flutuante já usado no resto do app

const VERDE = '#4dd87a';
const VERMELHO = '#f08060';
const AMARELO = 'var(--ouro)';

function calcEV(prob, odd) {
  const p = parseFloat(prob), o = parseFloat(odd);
  if (!p || !o || p <= 0 || p >= 100 || o <= 1) return null;
  return Math.round((p / 100) * o * 100) / 100;
}

function Linha({ label, value, color, destaque, icon: Icon }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--texto2)' }}>{label}</span>
      <strong style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: destaque ? 15 : 13, color: color || 'var(--texto)' }}>
        {value} {Icon && <Icon size={14} />}
      </strong>
    </div>
  );
}

function LinhaMercado({ linha, onChange, onRemover }) {
  const probFixo = linha.prob !== '' && linha.prob !== undefined;
  const p = parseFloat(linha.prob), o = parseFloat(linha.odd);
  const ev = calcEV(linha.prob, linha.odd);
  const temValor = ev !== null && ev >= 1.0;
  const casaPct = ev !== null ? Math.round((100 / o) * 10) / 10 : null;
  const edge = ev !== null ? Math.round((p - casaPct) * 10) / 10 : null;
  const oddJusta = ev !== null ? (100 / p).toFixed(2) : null;
  const recovery = ev !== null ? Math.ceil(1 / (o - 1)) : null;
  const riscoAlto = recovery !== null && recovery >= 5;

  return (
    <div className="calc-linha">
      {/* EV em destaque — resumo rápido no topo do card */}
      {ev !== null ? (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 22, fontWeight: 900, color: temValor ? VERDE : VERMELHO }}>
            {temValor ? <CheckCircle2 size={20} /> : <XCircle size={20} />} EV {ev}
          </div>
          <div style={{ fontSize: 11, color: 'var(--texto2)', marginTop: 2 }}>{temValor ? 'Tem valor' : 'Sem valor'}</div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 12, color: 'var(--texto2)' }}>Digite a odd da casa ↓</div>
      )}

      <div className="calc-linha-header">
        <input
          className="calc-mercado-input"
          type="text"
          placeholder="Ex: Over 2.5, Casa Vence..."
          value={linha.mercado}
          readOnly={probFixo}
          style={probFixo ? { color: 'var(--ouro)', fontWeight: 800 } : undefined}
          onChange={(e) => onChange(linha.id, 'mercado', e.target.value)}
        />
        <button className="calc-del" onClick={() => onRemover(linha.id)}><X size={14} /></button>
      </div>
      <div className="calc-fields">
        <div className="calc-field">
          <label>Sistema %</label>
          <input
            type="number" min="1" max="99" placeholder="65"
            value={linha.prob}
            style={probFixo ? { color: VERDE, borderColor: 'var(--verde2)' } : undefined}
            onChange={(e) => onChange(linha.id, 'prob', e.target.value)}
          />
        </div>
        <div className="calc-field">
          <label>Odd da casa</label>
          <input
            type="number" min="1.01" step="0.01" placeholder="1.80"
            value={linha.odd}
            style={{ borderColor: 'var(--ouro)' }}
            onChange={(e) => onChange(linha.id, 'odd', e.target.value)}
          />
        </div>
      </div>

      {/* Resultado — lista organizada, sem quadrados separados */}
      {ev !== null && (
        <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 9, padding: '4px 12px', marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '8px 0 2px' }}>Resultado</div>
          <Linha label="Sistema" value={`${p}%`} />
          <Linha label="Casa" value={`${casaPct}%`} />
          <Linha label="Odd" value={o} />
          <Linha label="Odd Justa" value={oddJusta} />
          <Linha label="Edge" value={`${edge > 0 ? '+' : ''}${edge}%`} color={edge > 0 ? VERDE : edge < 0 ? VERMELHO : undefined} />
          <Linha label="EV" value={ev} color={temValor ? VERDE : VERMELHO} icon={temValor ? CheckCircle2 : XCircle} destaque />
        </div>
      )}

      {/* Explicação do risco — recolhida por padrão, some espaço na tela */}
      {ev !== null && (
        <details className="calc-risco" style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, color: riscoAlto ? AMARELO : 'var(--texto2)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> Ver análise do risco
          </summary>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--c3)', fontSize: 11, color: 'var(--texto2)', lineHeight: 1.6 }}>
            Em odd {o}, cada red precisa de <strong style={{ color: 'var(--texto)' }}>{recovery} green{recovery > 1 ? 's' : ''} seguido{recovery > 1 ? 's' : ''}</strong> só pra empatar o prejuízo.
            "Tem valor" (EV positivo) não significa que é seguro — odds baixas exigem uma sequência de acerto bem mais longa pra compensar 1 erro.
          </div>
        </details>
      )}
    </div>
  );
}

export default function CalculadoraEV() {
  const [linhas, setLinhas] = useState([
    { id: Date.now(), mercado: 'Casa Vence', prob: '', odd: '' },
  ]);
  const [mercadoSelecionado, setMercadoSelecionado] = useState('');

  function atualizarLinha(id, campo, valor) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, { id: Date.now() + Math.random(), mercado: '', prob: '', odd: '' }]);
  }

  function removerLinha(id) {
    if (linhas.length === 1) { window.toast?.('⚠️ Mínimo 1 mercado'); return; }
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  }

  function adicionarMercadoEscolhido(idx) {
    setMercadoSelecionado(idx);
    if (idx === '' || idx == null) return;
    const ultimaAnalise = window.ultimaAnalise;
    const m = ultimaAnalise?.mercados?.[parseInt(idx, 10)];
    if (!m) return;

    setLinhas((prev) => {
      if (prev.length === 1 && !prev[0].mercado && !prev[0].prob && !prev[0].odd) {
        return [{ id: Date.now() + Math.random(), mercado: m.nome, prob: m.prob, odd: '' }];
      }
      return [...prev, { id: Date.now() + Math.random(), mercado: m.nome, prob: m.prob, odd: '' }];
    });

    setMercadoSelecionado('');
    window.toast?.(`✅ ${m.nome} adicionado! Digite a odd.`);
  }

  const ultimaAnalise = window.ultimaAnalise;

  return (
    <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
      {/* Header — só título, sem fórmula/legenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ background: 'rgba(245,197,24,.15)', border: '1px solid var(--ouro)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 size={18} color="var(--ouro)" /></div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Calculadora de EV</div>
          <div style={{ fontSize: 10, color: 'var(--texto2)' }}>Expected Value por mercado</div>
        </div>
      </div>

      {/* Importar da Análise — um seletor só, sem etapa extra de botão */}
      <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}><Download size={12} /> Importar da Análise</label>
        <select
          value={mercadoSelecionado}
          onChange={(e) => adicionarMercadoEscolhido(e.target.value)}
          disabled={!ultimaAnalise}
        >
          <option value="">{ultimaAnalise ? '— Selecione um mercado —' : '— Nenhuma análise ainda —'}</option>
          {ultimaAnalise?.mercados?.map((m, i) => (
            <option key={i} value={i}>{m.nome} — {m.prob}%</option>
          ))}
        </select>
        {ultimaAnalise && <div style={{ fontSize: 11, color: 'var(--texto2)', marginTop: 8 }}>{ultimaAnalise.casa} × {ultimaAnalise.vis}</div>}
      </div>

      {/* Linhas de mercado */}
      <div>
        {linhas.map((l) => (
          <LinhaMercado key={l.id} linha={l} onChange={atualizarLinha} onRemover={removerLinha} />
        ))}
      </div>
      <button
        onClick={adicionarLinha}
        style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--c1)', border: '1px dashed var(--c3)', borderRadius: 8, padding: 10, color: 'var(--texto2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        <Plus size={14} /> Adicionar Mercado
      </button>
    </div>
  );
}
