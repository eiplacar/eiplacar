import { CalendarDays, Send, Trophy, Gamepad2, Handshake, BarChart3, Zap, Goal } from 'lucide-react';

// ══ Dashboard (aba inicial) — sexto módulo migrado para React ══
//
// Mesmo padrão das migrações anteriores (AdicionarPartida, NovoSinalEntrada):
// o HTML virou JSX (mais fácil de ler/manter, ícones agora são Lucide de
// verdade), mas quem CALCULA e ESCREVE os números continua sendo o MESMO JS
// puro de sempre — public/js/07-geral.js (grade de campeonatos, estatísticas,
// últimos resultados) e public/js/11-jogosdodia.js (card "Jogos de Hoje").
// Essas funções escrevem direto nos elementos abaixo via document.getElementById,
// usando os MESMOS ids de antes — por isso este componente não guarda estado
// próprio, só monta a "casca" uma vez (ids fixos) e deixa o JS puro preencher.
//
// Pontes com o restante do app, que ainda é JS puro:
//   - window.renderGeral()               → preenche tudo daqui a partir de jogosCache
//   - window.filtrarCamp(nome) / filtrarTime(nome) → trocam o filtro e re-renderizam
//   - window.ophRenderLista() / ophCompartilharSelecionados() → card "Jogos de Hoje"
//   - window.abrirDetalheJogo(id)        → abre o modal de detalhe (fora desta aba)

export default function Dashboard() {
  return (
    <>
      {/* Jogos de Hoje: toque num jogo pra selecionar, depois compartilhe só os marcados */}
      <div className="card" id="ophListaCardDash" style={{ marginBottom: 14, display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div className="card-title" id="ophListaTituloDash" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={14} /> Jogos de Hoje (0)
          </div>
          <button
            id="ophBtnCompartilharDash"
            onClick={() => window.ophCompartilharSelecionados?.()}
            title="Compartilhar selecionados"
            style={{ display: 'none', flexShrink: 0, background: 'var(--c1)', border: '1px solid var(--verde2)', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--verde2)' }}
          >
            <Send size={15} />
          </button>
        </div>
        <div id="ophListaDash" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} />
      </div>

      {/* Grade de campeonatos: ponto de entrada. Clicar num campeonato abre as estatísticas dele */}
      <div className="card" id="cardCamps">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={15} /> Campeonatos</div>
        <div id="campList"><div className="empty"><div className="icon"><Trophy size={26} /></div><p>Sem campeonatos ainda.</p></div></div>
      </div>

      {/* Estatísticas do campeonato selecionado (só aparece depois de clicar num campeonato) */}
      <div id="geralCampSelecionado" style={{ display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 10, padding: '8px 10px 8px 8px', marginBottom: 12 }}>
          <button onClick={() => window.filtrarCamp?.('')} style={{ background: 'none', border: '1px solid var(--c3)', borderRadius: 7, padding: '7px 10px', color: 'var(--texto2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }} title="Voltar">←</button>
          <div id="geralCampNome" style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--ouro)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={14} />
          </div>
          <select id="filtroTimeGeral" onChange={(e) => window.filtrarTime?.(e.target.value)} style={{ flexShrink: 0, maxWidth: 130, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 7, padding: '7px 8px', color: 'var(--texto)', fontSize: 11, fontWeight: 700, outline: 'none' }}>
            <option value="">Todos os times</option>
          </select>
        </div>

        <div className="stats-grid">
          <div className="stat-box"><div className="stat-ic"><Gamepad2 size={18} /></div><div className="num" id="sTotal">0</div><div className="lbl">Jogos</div></div>
          <div className="stat-box"><div className="stat-ic"><Goal size={18} /></div><div className="num" id="sGols">0</div><div className="lbl">Gols</div></div>
          <div className="stat-box"><div className="stat-ic"><Handshake size={18} /></div><div className="num" id="sBtts">0</div><div className="lbl">Ambas Marcam</div></div>
          <div className="stat-box"><div className="stat-ic"><BarChart3 size={18} /></div><div className="num" id="sMedia">0.0</div><div className="lbl">Média Total Gols</div></div>
        </div>

        <div id="statsExtras" />

        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14} /> Últimos Resultados</div>
          <div id="recentList"><div className="empty"><div className="icon"><CalendarDays size={26} /></div><p>Nenhum jogo ainda.<br />Vá em <strong>Confrontos</strong> para lançar.</p></div></div>
        </div>
      </div>
    </>
  );
}
