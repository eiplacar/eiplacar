import { useEffect, useMemo, useState } from 'react';
import { Target, Dice5, Plus, Circle, TrendingUp, Wallet, CheckCircle2, Trophy, Shield, ArrowLeftRight, Coins, PiggyBank, ShieldQuestion, X, Check } from 'lucide-react';
import SeletorMercado from './SeletorMercado';

// ══ Nova Entrada (sub-aba "Registrar Operação" dentro de Apostas) ══
//
// Este formulário é MUITO entrelaçado com a Banca (bpLoad/bpSave, cálculo de lucro,
// modal de confirmação com Promise) — por isso a migração aqui continua sendo "de
// organização": o HTML virou este componente React com os MESMOS ids de sempre, os
// campos continuam não controlados, e todo clique chama as mesmas funções JS puras de
// sempre (window.setTipoAposta, window.lancarEntrada, window.calcEntrada...), agora
// em public/js/13-calculadora.js.
//
// Mudanças pedidas nessa leva (baseadas no mockup "Registrar Operação"):
//   - Tirou o "Importar da Análise" (não vamos mais puxar da Análise aqui)
//   - Liga → ao escolher, aparecem dois selects (Mandante/Visitante) com os times
//     daquele campeonato — em vez do combo "Jogo" único do mockup
//   - Mercado: além do campo de texto livre (com datalist), agora tem um seletor
//     guiado (SeletorMercado.jsx) — abre sozinho ao clicar em Bet/Exchange. Categorias:
//     Gols, Cartões, Escanteios e Resultado, todas com Partida/1ºT/2ºT, e Outros
//     (mercado livre). No Exchange, pergunta A Favor (Back) ou Contra (Lay) antes de
//     preencher o campo.
//   - 4º tipo de aposta "Outros" virou "Sistema": em vez de pernas de mercado+odd,
//     pede só o valor investido e o lucro direto
//   - Nova seção "Operação": Bet ou Exchange
//   - Novo campo "Retorno" (calculado sozinho: stake + lucro), com legenda pequena
//   - Resultado agora é Green / Red / Void / Cash Out (era Green/Red/Void/Cancelado)

// Escudo do time — mesmo padrão usado na aba Análise/Classificação/Estratégias.
function EscudoImg({ nome, size = 20 }) {
  const url = window.getEscudo ? window.getEscudo(nome) : null;
  if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
  return <ShieldQuestion size={size * 0.8} color="var(--texto2)" style={{ flexShrink: 0 }} />;
}

// Bottom-sheet com busca + escudo de cada time no seletor — mesmo componente/padrão
// usado na aba Análise (SeletorAnalise.jsx) e Estratégias, pra escolher Mandante/Visitante
// sem precisar rolar um <select> nativo sem escudo nenhum.
function SeletorTimeSheet({ titulo, times, valorAtual, onSelecionar, onFechar }) {
  const [busca, setBusca] = useState('');
  const filtrados = busca ? times.filter((t) => t.toLowerCase().includes(busca.toLowerCase())) : times;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={onFechar}>
      <div style={{ background: 'var(--c2)', width: '100%', maxHeight: '78vh', borderRadius: '16px 16px 0 0', padding: '14px 16px 20px', overflowY: 'auto', borderTop: '1px solid var(--c3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{titulo}</div>
          <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', color: 'var(--texto2)', padding: 4, cursor: 'pointer' }}><X size={20} /></button>
        </div>
        {times.length > 8 && (
          <input autoFocus placeholder="Buscar time..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
        )}
        <div>
          {filtrados.map((t) => (
            <div key={t} onClick={() => { onSelecionar(t); onFechar(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px', borderBottom: '1px solid var(--c3)', cursor: 'pointer', borderRadius: 6, background: t === valorAtual ? 'rgba(77,216,122,0.08)' : 'transparent' }}>
              <EscudoImg nome={t} size={24} />
              <span style={{ flex: 1, fontSize: 13.5 }}>{t}</span>
              {t === valorAtual && <Check size={16} color="var(--verde2)" />}
            </div>
          ))}
          {!filtrados.length && <div style={{ textAlign: 'center', color: 'var(--texto2)', padding: 20, fontSize: 13 }}>Nada encontrado.</div>}
        </div>
      </div>
    </div>
  );
}

export default function NovaEntrada() {
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [seletorOperacao, setSeletorOperacao] = useState('bet');
  const [operacaoAtual, setOperacaoAtual] = useState('bet'); // fonte única da verdade pro campo #eOperacao — ver input controlado abaixo
  const [liga, setLiga] = useState(''); // sincronizado do #eLiga (não-controlado) só pra filtrar a lista de times do seletor
  const [mandante, setMandante] = useState('');
  const [visitante, setVisitante] = useState('');
  const [seletorTimeAberto, setSeletorTimeAberto] = useState(null); // null | 'mandante' | 'visitante'

  const jogosCache = window.jogosCache || [];
  const timesDaLiga = useMemo(() => {
    if (!liga) return [];
    return [...new Set(jogosCache.filter((j) => j.camp === liga).flatMap((j) => [j.casa, j.vis]))].sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liga, jogosCache.length]);

  // Escreve "Mandante × Visitante" direto no campo #eTimes de verdade (o mesmo de
  // sempre, continua não-controlado — é ele que lancarEntrada/editarEntrada leem pra
  // valer) e nos inputs escondidos #eMandanteSel/#eVisitanteSel, mantidos só pra
  // compatibilidade com SeletorMercado.jsx, que ainda lê esses ids direto do DOM.
  function sincronizarCamposOcultos(novoMandante, novoVisitante) {
    const eTimes = document.getElementById('eTimes');
    if (eTimes) eTimes.value = (novoMandante && novoVisitante) ? `${novoMandante} × ${novoVisitante}` : (novoMandante || novoVisitante || '');
    const selM = document.getElementById('eMandanteSel'); if (selM) selM.value = novoMandante;
    const selV = document.getElementById('eVisitanteSel'); if (selV) selV.value = novoVisitante;
    window.atualizarResumoEntrada?.();
  }
  function escolherMandante(nome) { setMandante(nome); sincronizarCamposOcultos(nome, visitante); }
  function escolherVisitante(nome) { setVisitante(nome); sincronizarCamposOcultos(mandante, nome); }

  // Rede de segurança: sempre que Mandante/Visitante mudarem (ou o campo #eTimes for
  // recriado do zero — ex.: quando o usuário mexe na Liga e o formulário alterna entre
  // o campo de texto livre e os botões com escudo, o que troca o nó do DOM e perde
  // qualquer valor setado antes), re-sincroniza pra garantir que #eTimes nunca fique
  // desatualizado em relação ao que já foi escolhido. Isso corrige o bug de "Salvar
  // Operação" pedindo pra selecionar o time mesmo com Casa/Visitante já preenchidos.
  useEffect(() => {
    if (mandante || visitante) sincronizarCamposOcultos(mandante, visitante);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mandante, visitante, timesDaLiga.length]);

  // Ponte pra 13-calculadora.js: depois de salvar a operação, o form inteiro é limpo
  // (inclusive na mão, via DOM) — isso avisa esse componente React pra limpar a seleção
  // de Mandante/Visitante/Liga junto, senão o botão continuava mostrando o time antigo.
  useEffect(() => {
    window.novaEntradaResetarSelecaoTimes = () => { setLiga(''); setMandante(''); setVisitante(''); };
    return () => { delete window.novaEntradaResetarSelecaoTimes; };
  }, []);

  // Clicar em Bet ou Exchange já define a Operação (função de sempre, window.setOperacao,
  // que só cuida do visual dos botões — o valor de verdade vive aqui, no estado do React)
  // e abre o Seletor de Mercado guiado, no modo certo (Bet ou Exchange).
  function escolherOperacaoEAbrirSeletor(tipo) {
    window.setOperacao?.(tipo);
    setOperacaoAtual(tipo);
    setSeletorOperacao(tipo);
    setSeletorAberto(true);
  }

  // Bet ou Exchange (acima) já abrem o Seletor de Mercado guiado — não tem mais nenhum
  // outro jeito de reabri-lo além desses dois botões.

  // Escreve o texto escolhido no campo #eMercado (não-controlado, como o resto do form)
  // e dispara o mesmo recalculo do resumo que o campo já usava ao digitar.
  function definirMercado(texto) {
    const el = document.getElementById('eMercado');
    if (el) el.value = texto;
    window.atualizarResumoEntrada?.();
  }

  return (
    <div className="card" style={{ borderRadius: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--c3)' }}>
        <div style={{ background: 'rgba(37,163,82,.15)', border: '1px solid var(--verde2)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Target size={18} color="var(--verde2)" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Registrar Operação</div>
          <div style={{ fontSize: 10, color: 'var(--texto2)' }}>Preencha os dados da sua entrada</div>
        </div>
      </div>

      {/* Data (dia do registro) */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Data</label>
        <input type="date" id="eDataEntrada" />
      </div>

      {/* Liga */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Liga</label>
        <input type="text" id="eLiga" list="campSugEntrada" placeholder="Ex: Premier League" onInput={(e) => { setLiga(e.target.value.trim()); window.atualizarResumoEntrada?.(); }} />
      </div>

      {/* Jogo — Mandante × Visitante. Quando a Liga digitada bate com uma já cadastrada
          (com times conhecidos em Dados/Confrontos), abre o seletor com busca + escudo —
          mesmo padrão da aba Análise. Sem isso, cai no campo de texto livre de sempre. */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={13} /> Jogo (Casa × Visitante)</label>
        {timesDaLiga.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => setSeletorTimeAberto('mandante')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px', cursor: 'pointer', textAlign: 'left' }}>
                <EscudoImg nome={mandante} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: mandante ? 'var(--texto)' : 'var(--texto2)', fontSize: 12, fontWeight: 700 }}>{mandante || 'Casa'}</span>
              </button>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--texto2)' }}>×</div>
              <button type="button" onClick={() => setSeletorTimeAberto('visitante')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px', cursor: 'pointer', textAlign: 'right', justifyContent: 'flex-end' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: visitante ? 'var(--texto)' : 'var(--texto2)', fontSize: 12, fontWeight: 700 }}>{visitante || 'Visitante'}</span>
                <EscudoImg nome={visitante} />
              </button>
            </div>
            {/* #eTimes continua existindo no DOM (lancarEntrada/editarEntrada leem ele direto
                pra valer) — só fica escondido aqui porque os botões acima já mostram tudo. */}
            <input type="hidden" id="eTimes" defaultValue="" />
          </>
        ) : (
          <input type="text" id="eTimes" placeholder="Ex: Botafogo-SP × Avaí" onInput={() => window.atualizarResumoEntrada?.()} />
        )}
      </div>
      <input type="hidden" id="eMandanteSel" defaultValue="" />
      <input type="hidden" id="eVisitanteSel" defaultValue="" />

      {seletorTimeAberto === 'mandante' && (
        <SeletorTimeSheet titulo="Escolha a Casa" times={timesDaLiga} valorAtual={mandante} onSelecionar={escolherMandante} onFechar={() => setSeletorTimeAberto(null)} />
      )}
      {seletorTimeAberto === 'visitante' && (
        <SeletorTimeSheet titulo="Escolha o Visitante" times={timesDaLiga} valorAtual={visitante} onSelecionar={escolherVisitante} onFechar={() => setSeletorTimeAberto(null)} />
      )}

      {/* Tipo de Aposta (chips) */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Dice5 size={13} /> Tipo de Aposta</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <button type="button" onClick={() => window.setTipoAposta?.('simples')} id="btnApostaSimples" style={{ flex: '0 0 auto', padding: '6px 16px', borderRadius: 20, border: '1px solid var(--verde2)', background: 'rgba(37,163,82,.15)', color: 'var(--verde2)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Simples</button>
        <button type="button" onClick={() => window.setTipoAposta?.('dupla')} id="btnApostaDupla" style={{ flex: '0 0 auto', padding: '6px 16px', borderRadius: 20, border: '1px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Dupla</button>
        <button type="button" onClick={() => window.setTipoAposta?.('multipla')} id="btnApostaMultipla" style={{ flex: '0 0 auto', padding: '6px 16px', borderRadius: 20, border: '1px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Múltipla</button>
        <button type="button" onClick={() => window.setTipoAposta?.('sistema')} id="btnApostaSistema" style={{ flex: '0 0 auto', padding: '6px 16px', borderRadius: 20, border: '1px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Sistema</button>
      </div>

      {/* Mercado (Simples) — por enquanto um campo simples, sem lógica extra (vem depois).
          O jeito de abrir o Seletor de Mercado guiado é clicando em Bet ou Exchange, ali
          em cima — não precisa de um botão "Escolher" duplicado aqui do lado. */}
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

      {/* Sistema — em vez de pernas de mercado+odd, é só o valor investido e o lucro direto */}
      <div id="blocoSistema" style={{ display: 'none', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Wallet size={13} /> Valor Investido (R$)</label>
            <input type="text" inputMode="decimal" id="eSistemaStake" placeholder="Ex: 50,00" onInput={() => { window.calcEntrada?.(); window.atualizarResumoEntrada?.(); }} />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Coins size={13} /> Lucro (R$)</label>
            <input type="text" inputMode="decimal" id="eSistemaLucro" placeholder="Ex: 15,00" onInput={() => { window.calcEntrada?.(); window.atualizarResumoEntrada?.(); }} />
          </div>
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

      {/* Operação: Bet ou Exchange */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><ArrowLeftRight size={13} /> Operação</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <button type="button" id="btnOperacaoBet" onClick={() => escolherOperacaoEAbrirSeletor('bet')}
          style={{ padding: 10, borderRadius: 8, border: '1px solid var(--verde2)', background: 'rgba(37,163,82,.15)', color: 'var(--verde2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          Bet
        </button>
        <button type="button" id="btnOperacaoExchange" onClick={() => escolherOperacaoEAbrirSeletor('exchange')}
          style={{ padding: 10, borderRadius: 8, border: '1px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          Exchange
        </button>
      </div>
      <input type="hidden" id="eOperacao" value={operacaoAtual} readOnly />

      <SeletorMercado
        aberto={seletorAberto}
        operacao={seletorOperacao}
        onFechar={() => setSeletorAberto(false)}
        onSelecionar={definirMercado}
      />

      {/* Tipo de entrada (compacto) */}
      <label style={{ marginBottom: 6 }}>Tipo de Entrada</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <button type="button" id="btnTipoPre" onClick={() => window.setTipoEntrada?.('prelive')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, borderRadius: 8, border: '1px solid var(--verde2)', background: 'rgba(37,163,82,.15)', color: 'var(--verde2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          <Circle size={10} fill="currentColor" /> Pré-live
        </button>
        <button type="button" id="btnTipoLive" onClick={() => window.setTipoEntrada?.('live')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, borderRadius: 8, border: '1px solid var(--c3)', background: 'var(--c1)', color: 'var(--texto2)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          <Circle size={10} fill="currentColor" /> Ao Vivo
        </button>
      </div>
      <input type="hidden" id="eTipo" defaultValue="prelive" />

      {/* Minuto (live) */}
      <div id="campoMinutoEntrada" style={{ display: 'none', marginBottom: 12 }}>
        <label>Minuto de Entrada (ao vivo)</label>
        <input type="number" id="eMinuto" min="0" max="120" placeholder="Ex: 20" onInput={() => window.atualizarResumoEntrada?.()} />
      </div>

      {/* Stake + Odd de Entrada */}
      <div id="blocoPctBanca" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          {/* Em vez de escolher uma % fixa, a pessoa digita o valor em R$ que quer apostar (o "Stake") —
              o sistema calcula a % da banca correspondente sozinho (guardado por baixo dos
              panos em #ePct, que é o que o resto do código já usa pra tudo).
              type="text" + inputMode="decimal" (em vez de type="number"): campos number rejeitam
              vírgula em vários teclados Android — a pessoa digitava "1,10" e o valor sumia. */}
          <label>Stake (R$)</label>
          <input type="text" inputMode="decimal" id="eValorStake" placeholder="Ex: 10,00" title="Digite o valor em reais que você quer apostar" onInput={(e) => window.setValorStake?.(e.target.value)} />
          <input type="hidden" id="ePct" defaultValue="" />
        </div>
        <div>
          <label>Odd de Entrada</label>
          <input type="text" inputMode="decimal" id="eOdd" placeholder="Ex: 1,90" onInput={() => window.calcEntrada?.()} />
        </div>
      </div>

      {/* Retorno (calculado sozinho, mas editável — se a casa pagou diferente do calculado,
          é só corrigir aqui que o Resumo já usa o valor certo) + Resultado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div id="blocoRetornoEntrada">
          <label>Retorno (R$)</label>
          <input type="text" inputMode="decimal" id="eRetorno" placeholder="Ex: 18,10" title="Calculado sozinho a partir do Stake e da Odd — se a casa pagou um valor diferente, corrija aqui" onInput={(e) => window.editarRetorno?.(e.target.value)} />
        </div>
        <div>
          <label>Resultado</label>
          <select id="eResultado" defaultValue="">
            <option value="" disabled>Selecione</option>
            <option value="green">Green</option>
            <option value="red">Red</option>
            <option value="void">Void</option>
            <option value="cashout">Cash Out</option>
          </select>
        </div>
      </div>

      {/* Resumo da Operação (Lucro / % da Banca / Retorno Total) */}
      <div id="blocoGestaoEntrada">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><PiggyBank size={13} /> Resumo da Operação</label>
        <div id="entradaPreview" style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 9, padding: 12, marginBottom: 14, fontSize: 12, color: 'var(--texto2)' }}>
          Preencha o Stake e o Retorno para ver o resumo
        </div>
      </div>

      <button className="btn-primary" onClick={() => window.lancarEntrada?.()} style={{ borderRadius: 10, padding: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <CheckCircle2 size={16} /> Salvar Operação
      </button>
    </div>
  );
}
