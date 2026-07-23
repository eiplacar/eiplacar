import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Undo2, Pencil, Trash2, Calendar, Target } from 'lucide-react';

// ══ Apostas Resolvidas — 11º módulo migrado para React ══
// Lista o histórico de entradas lançadas na Calculadora, com filtro por data.
// A liquidação (green/red/void) já aconteceu no lançamento — aqui é só consulta,
// edição e exclusão (que revertem/recalculam o efeito na Carteira/Reserva).
//
// Pontes com o JS puro (public/js/13-calculadora.js):
//   - window.computeHistoricoEntradas(filtro)
//   - window.editarEntrada(id) → abre o modal de edição (compartilhado com o formulário antigo)
//   - window.excluirEntrada(id) → abre o modal de confirmação de exclusão
// window.resolvidasRefresh é o "sininho" chamado sempre que uma entrada é
// lançada/editada/excluída, ou quando a aba é reaberta.

const ROTULO_APOSTA = { simples: 'Simples', dupla: 'Dupla', multipla: 'Múltipla', outros: 'Outros' };
const COR_APOSTA = { dupla: 'var(--ouro)', multipla: '#f08060', outros: '#8b7ae8' };

export default function Resolvidas() {
  const [, setTick] = useState(0);
  const [modo, setModo] = useState('');
  const [dia, setDia] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  useEffect(() => {
    window.resolvidasRefresh = () => setTick((t) => t + 1);
    return () => { delete window.resolvidasRefresh; };
  }, []);

  const entradas = window.computeHistoricoEntradas ? window.computeHistoricoEntradas({ modo, dia, de, ate }) : [];
  const fd = window.fd || ((s) => s);

  let resumo = '';
  if (modo === 'dia' && dia) resumo = `${entradas.length} entrada${entradas.length === 1 ? '' : 's'} no dia ${fd(dia)}`;
  else if (modo === 'periodo' && (de || ate)) {
    const rot = de && ate ? `de ${fd(de)} até ${fd(ate)}` : de ? `a partir de ${fd(de)}` : `até ${fd(ate)}`;
    resumo = `${entradas.length} entrada${entradas.length === 1 ? '' : 's'} ${rot}`;
  }

  return (
    <>
      <div className="sel-card" style={{ padding: '12px 16px' }}>
        <div className="sel-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} /> Filtrar por Data</div>
        <select value={modo} onChange={(e) => setModo(e.target.value)} style={{ marginBottom: 8 }}>
          <option value="">Todas as datas</option>
          <option value="dia">Um dia específico</option>
          <option value="periodo">Período (de/até)</option>
        </select>
        {modo === 'dia' && (
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        )}
        {modo === 'periodo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label>De</label><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
            <div><label>Até</label><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Resolvidas</div>
        {resumo && (
          <div style={{ background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={13} /> {resumo}</div>
        )}
        {entradas.length === 0 ? (
          <div className="empty"><div className="icon"><Target size={22} /></div><p>{resumo ? 'Nenhuma entrada nesse filtro.' : 'Nenhuma entrada ainda.'}</p></div>
        ) : entradas.map((e) => {
          const Icone = e.resultado === 'green' ? CheckCircle2 : e.resultado === 'red' ? XCircle : Undo2;
          const cor = e.resultado === 'green' ? '#4dd87a' : e.resultado === 'red' ? '#f08060' : 'var(--texto2)';
          const val = e.resultado === 'green' ? `+R$ ${(e.ganhoCarteira || 0).toFixed(2)}` : e.resultado === 'red' ? `-R$ ${(e.stake || 0).toFixed(2)}` : 'Void';
          const rotuloAposta = ROTULO_APOSTA[e.tipoAposta] || 'Simples';
          const corAposta = COR_APOSTA[e.tipoAposta] || 'var(--texto2)';
          return (
            <div key={e.id} className="entrada-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Icone size={18} color={cor} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{e.desc}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: corAposta, border: `1px solid ${corAposta}`, borderRadius: 4, padding: '1px 5px' }}>{rotuloAposta}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--texto2)' }}>{e.data} · Odd {e.odd} · {e.pct}% · Stake R$ {(e.stake || 0).toFixed(2)}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: cor }}>{val}</div>
                <button onClick={() => window.editarEntrada(e.id)} className="so-organizador" style={{ background: 'none', border: '1px solid var(--c3)', borderRadius: 5, padding: '3px 7px', color: 'var(--texto2)', cursor: 'pointer' }}><Pencil size={12} /></button>
                <button onClick={() => window.excluirEntrada(e.id)} className="btn-danger so-organizador" style={{ padding: '3px 7px' }}><Trash2 size={12} /></button>
              </div>
              {e.resultado === 'green' && (
                <div style={{ fontSize: 10, color: 'var(--texto2)', paddingLeft: 26 }}>Reserva: R$ {(e.reservaCorte || 0).toFixed(2)} · Carteira: R$ {(e.ganhoCarteira || 0).toFixed(2)}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
