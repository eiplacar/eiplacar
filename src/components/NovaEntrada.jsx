import { Target, Zap, Dice5, Plus, Circle, TrendingUp, Wallet, BarChart3, CheckCircle2 } from 'lucide-react';

// ══ Nova Entrada (sub-aba dentro de Apostas) — sexto módulo migrado para React ══
//
// Este formulário é MUITO entrelaçado com a Banca (bpLoad/bpSave, distribuição de
// lucro por participante, modal de confirmação com Promise) — e Banca é justamente
// o módulo que fica pra depois, porque ainda vai passar por mudanças. Reescrever essa
// lógica agora seria arriscado e provavelmente jogado fora depois.
//
// Por isso a migração aqui foi "de organização", igual à Adicionar Partida: o HTML
// virou este componente React com os MESMOS ids de sempre, os campos continuam não
// controlados, e todo clique chama as mesmas funções JS puras de sempre
// (window.setTipoAposta, window.lancarEntrada, window.calcEntrada...). Nada nelas
// precisou mudar. Só trocamos emoji por ícones — os ícones dentro de botões que o JS
// puro colore dinamicamente (Pré-live/Ao Vivo, chips de aposta) usam currentColor,
// então acompanham a cor que o JS aplicar sozinhos.

export default function NovaEntrada() {
  return (
    <div className="card so-organizador" style={{ borderRadius: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--c3)' }}>
        <div style={{ background: 'rgba(37,163,82,.15)', border: '1px solid var(--verde2)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Target size={18} color="var(--verde2)" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Nova Entrada</div>
          <div style={{ fontSize: 10, color: 'var(--texto2)' }}>Registrar operação na banca</div>
        </div>
      </div>

      {/* Resumo da operação — atualiza sozinho conforme os campos abaixo são preenchidos */}
      <div id="resumoEntrada" style={{ background: 'var(--c1)', border: '1px solid var(--ouro)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--texto2)', lineHeight: 1.8 }}>
        Preencha os campos abaixo para montar o resumo da operação.
      </div>

      {/* Buscar da análise */}
      <div id="mercadoSugestoesWrap" style={{ display: 'none', marginBottom: 12 }}>
        <label id="mercadoSugestoesLabel" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={12} /> Mercados da última análise</label>
        <select id="mercadoSugestoes" onChange={(e) => window.selecionarMercado?.(e.target.value)}></select>
      </div>
      <button
        type="button"
        onClick={() => window.buscarMercadoAnalise?.()}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--gramado)', border: '1px solid var(--verde2)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 14 }}
      >
        <Zap size={13} /> Importar da Análise
      </button>

      {/* Liga */}
      <div style={{ marginBottom: 12 }}>
        <label>Liga</label>
        <input type="text" id="eLiga" list="campSugEntrada" placeholder="Ex: La Liga" onInput={() => window.atualizarResumoEntrada?.()} />
      </div>

      {/* Tipo de Aposta (chips) */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Dice5 size={13} /> Tipo de Aposta</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <button type="button" onClick={() => window.setTipoAposta?.('simples')} id="btnApostaSimples" style={{ flex: '0 0 auto', padding: '6px 16px', borderRadius: 20, border: '2px solid var(--verde2)', background: 'rgba(37,163,82,.15)', color: 'var(--verde2)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Simples</button>
        <button type="button" onClick={() => window.setTipoAposta?.('dupla')} id="btnApostaDupla" style={{ flex: '0 0 auto', padding: '6px 16px', borderRadius: 20, border: '2px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Dupla</button>
        <button type="button" onClick={() => window.setTipoAposta?.('multipla')} id="btnApostaMultipla" style={{ flex: '0 0 auto', padding: '6px 16px', borderRadius: 20, border: '2px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Múltipla</button>
        <button type="button" onClick={() => window.setTipoAposta?.('outros')} id="btnApostaOutros" style={{ flex: '0 0 auto', padding: '6px 16px', borderRadius: 20, border: '2px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Outros</button>
      </div>

      {/* Mercado (Simples) */}
      <div id="blocoMercadoSimples" style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={13} /> Mercado</label>
        <input type="text" id="eMercado" list="mercadoDatalist" placeholder="Ex: Over 2.5" onInput={() => window.atualizarResumoEntrada?.()} />
      </div>

      {/* Pernas (Dupla/Múltipla) */}
      <div id="blocoPernas" style={{ display: 'none', marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: 'var(--texto2)', cursor: 'pointer' }}>
          <input type="checkbox" id="mesmoJogoCheck" onChange={() => window.toggleMesmoJogo?.()} style={{ width: 'auto' }} />
          Todos os mercados são do mesmo jogo?
        </label>
        <div id="blocoConfrontoCombo" style={{ display: 'none', marginBottom: 10 }}>
          <label>Confronto (Casa × Visitante)</label>
          <input type="text" id="eTimesCombo" placeholder="Ex: Botafogo-SP × Avaí" onInput={(e) => { const eTimes = document.getElementById('eTimes'); if (eTimes) eTimes.value = e.target.value.trim(); window.atualizarResumoEntrada?.(); }} />
        </div>
        <label style={{ marginBottom: 6 }}>Mercados combinados</label>
        <div id="pernasLista" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}></div>
        <button type="button" id="btnAddPerna" onClick={() => window.adicionarPerna?.()} style={{ display: 'none', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--c1)', border: '1px dashed var(--c3)', borderRadius: 8, padding: 8, color: 'var(--texto2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
          <Plus size={13} /> Adicionar Perna
        </button>
        <div style={{ background: 'var(--c1)', border: '1px solid var(--ouro)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Odd Combinada</div>
          <div id="oddCombinadaDisplay" style={{ fontSize: 20, fontWeight: 900, color: 'var(--ouro)' }}>—</div>
        </div>
      </div>
      <datalist id="campSugEntrada"></datalist>
      <datalist id="mercadoDatalist">
        <option value="Resultado" />
        <option value="Over 1.5" />
        <option value="Over 2.5" />
        <option value="Over 3.5" />
        <option value="Over 4.5" />
        <option value="Ambas Marcam" />
        <option value="Cantos" />
        <option value="Cartões" />
      </datalist>
      <input type="hidden" id="eTimes" defaultValue="" />

      {/* Tipo de entrada (compacto) */}
      <label style={{ marginBottom: 6 }}>Tipo de Entrada</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <button type="button" id="btnTipoPre" onClick={() => window.setTipoEntrada?.('prelive')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, borderRadius: 8, border: '2px solid var(--verde2)', background: 'rgba(37,163,82,.15)', color: 'var(--verde2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          <Circle size={10} fill="currentColor" /> Pré-live
        </button>
        <button type="button" id="btnTipoLive" onClick={() => window.setTipoEntrada?.('live')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, borderRadius: 8, border: '2px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          <Circle size={10} fill="currentColor" /> Ao Vivo
        </button>
      </div>
      <input type="hidden" id="eTipo" defaultValue="prelive" />

      {/* Minuto (live) */}
      <div id="campoMinutoEntrada" style={{ display: 'none', marginBottom: 12 }}>
        <label>Minuto de Entrada (ao vivo)</label>
        <input type="number" id="eMinuto" min="0" max="120" placeholder="Ex: 20" onInput={() => window.atualizarResumoEntrada?.()} />
      </div>

      {/* % da Banca */}
      <label>% da Banca</label>
      <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }}>
        <button className="btn-pct" onClick={(e) => window.setPct?.(1, e)} style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 15, fontWeight: 900 }}>1%</button>
        <button className="btn-pct" onClick={(e) => window.setPct?.(2, e)} style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 15, fontWeight: 900 }}>2%</button>
        <button className="btn-pct" onClick={(e) => window.setPct?.(3, e)} style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 15, fontWeight: 900 }}>3%</button>
        <input type="number" id="ePct" min="1" max="10" placeholder="%" style={{ width: 64, textAlign: 'center', fontSize: 15, fontWeight: 800 }} onInput={() => window.calcEntrada?.()} />
      </div>

      {/* Gestão da Entrada (card único: banca / stake / lucro potencial) */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Wallet size={13} /> Gestão da Entrada</label>
      <div id="entradaPreview" style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 9, padding: 12, marginBottom: 14, fontSize: 12, color: 'var(--texto2)' }}>
        Selecione % da banca para ver o valor
      </div>

      {/* Odd + Resultado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label>Odd</label>
          <input type="number" id="eOdd" min="1.01" step="0.01" placeholder="1.80" onInput={() => window.calcEntrada?.()} />
        </div>
        <div>
          <label>Resultado</label>
          <select id="eResultado" defaultValue="cancelado">
            <option value="cancelado">⬜ Cancelado</option>
            <option value="green">✅ Green</option>
            <option value="red">❌ Red</option>
            <option value="void">↩️ Void</option>
          </select>
        </div>
      </div>

      {/* Data */}
      <div style={{ marginBottom: 14 }}>
        <label>Data da Entrada</label>
        <input type="date" id="eDataEntrada" />
      </div>

      <button className="btn-primary" onClick={() => window.lancarEntrada?.()} style={{ borderRadius: 10, padding: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <CheckCircle2 size={16} /> Salvar Operação
      </button>
    </div>
  );
}
