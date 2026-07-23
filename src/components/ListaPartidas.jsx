import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Search, Pencil, X } from 'lucide-react';

// ══ Lista de Partidas (aba Dados) — segundo módulo migrado para React ══
//
// Mesma lógica e mesmo visual de antes (era JS puro em public/js/08-dados-render.js).
// Pontes com o restante do app, que ainda é JS puro:
//   - window.jogosCache        → array de jogos (sincronizado a cada renderDados()/popularFiltroRodada())
//   - window.fd / sortNatural / optionsCampeonato → utilitários (04-utils.js)
//   - window.abrirEditarJogo(id) / window.deletarJogo(id) → ações por linha (modais ainda em JS puro)
//   - window.dadosReactRefresh / window.dadosResetPagina → "sininhos" que o resto do app
//     continua chamando pelos nomes de sempre (renderDados/popularFiltroRodada), pra este
//     componente saber a hora de se atualizar.

const TAM_PAGINA = 50;

const ICO_GOAL = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:2px"><path d="M12 13V2l8 4-8 4"/><path d="M20.561 10.222a9 9 0 1 1-12.55-5.29"/><path d="M8.002 9.997a5 5 0 1 0 8.9 2.02"/></svg>';

function celulaMinutos(j) {
  const gols = j.gols || [];
  if (!gols.length) return '—';
  const gC = gols.filter((g) => g.time === 'casa');
  const gV = gols.filter((g) => g.time === 'vis');
  const lc = gC.length ? `<span class="min-casa">${ICO_GOAL}${j.casa}: ${gC.map((g) => g.min + "'").join(', ')}</span>` : '';
  const lv = gV.length ? `<span class="min-vis">${ICO_GOAL}${j.vis}: ${gV.map((g) => g.min + "'").join(', ')}</span>` : '';
  return `<div class="minutos-cell">${[lc, lv].filter(Boolean).join('<br>')}</div>`;
}

function celulaCartoes(j) {
  const tem = j.amarelosC != null || j.amarelosV != null || j.vermelhosC != null || j.vermelhosV != null;
  if (!tem) return '—';
  const icoAmarelo = '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="#e0c23c" stroke="#e0c23c" stroke-width="2" rx="3" style="vertical-align:-1px;margin-right:3px"><rect width="16" height="22" x="4" y="1" rx="2.5"/></svg>';
  const icoVermelho = '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="#f08060" stroke="#f08060" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><rect width="16" height="22" x="4" y="1" rx="2.5"/></svg>';
  return `<div style="white-space:nowrap">${icoAmarelo} ${j.amarelosC ?? 0} × ${j.amarelosV ?? 0}</div><div style="white-space:nowrap">${icoVermelho} ${j.vermelhosC ?? 0} × ${j.vermelhosV ?? 0}</div>`;
}

function LinhaJogo({ j, numero }) {
  const fd = window.fd || ((s) => s || '—');
  const ht = j.golsHT_C != null || j.golsHT_V != null ? `${j.golsHT_C ?? '—'} × ${j.golsHT_V ?? '—'}` : '—';
  const st = j.golsHT_C != null || j.golsHT_V != null
    ? `${j.golsHT_C != null ? Math.max(0, (j.gC || 0) - j.golsHT_C) : '—'} × ${j.golsHT_V != null ? Math.max(0, (j.gV || 0) - j.golsHT_V) : '—'}`
    : '—';
  const chutes = j.chutesC != null || j.chutesV != null ? `${j.chutesC ?? '—'} × ${j.chutesV ?? '—'}` : '—';
  const chutesGol = j.chutesGolC != null || j.chutesGolV != null ? `${j.chutesGolC ?? '—'} × ${j.chutesGolV ?? '—'}` : '—';
  const escanteios = j.escanteiosC != null || j.escanteiosV != null ? `${j.escanteiosC ?? '—'} × ${j.escanteiosV ?? '—'}` : '—';

  return (
    <tr>
      <td style={{ color: 'var(--texto2)' }}>{numero}</td>
      <td style={{ color: 'var(--verde2)', fontWeight: 600 }}>{j.camp}</td>
      <td style={{ whiteSpace: 'nowrap', color: 'var(--texto2)' }}>{fd(j.data)}</td>
      <td style={{ color: 'var(--texto2)' }}>{j.rodada || '—'}</td>
      <td style={{ color: 'var(--texto2)', fontSize: 11 }}>{j.local || '—'}</td>
      <td><strong>{j.casa}</strong></td>
      <td className="td-c">{j.gC} × {j.gV}</td>
      <td><strong>{j.vis}</strong></td>
      <td className="td-r">{j.rankC ?? '—'}</td>
      <td className="td-r">{j.rankV ?? '—'}</td>
      <td className="td-c" style={{ fontSize: 13, color: 'var(--texto2)', whiteSpace: 'nowrap' }}>{ht}</td>
      <td className="td-c" style={{ fontSize: 13, color: 'var(--texto2)', whiteSpace: 'nowrap' }}>{st}</td>
      <td className="td-c" style={{ fontSize: 11, color: 'var(--texto2)' }}>{chutes}</td>
      <td className="td-c" style={{ fontSize: 11, color: 'var(--texto2)' }}>{chutesGol}</td>
      <td className="td-c" style={{ fontSize: 11, color: 'var(--texto2)' }}>{escanteios}</td>
      <td className="td-c" style={{ fontSize: 11, color: 'var(--texto2)' }} dangerouslySetInnerHTML={{ __html: celulaCartoes(j) }} />
      <td dangerouslySetInnerHTML={{ __html: celulaMinutos(j) }} />
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="btn-primary so-organizador" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => window.abrirEditarJogo?.(j.id)}><Pencil size={12} /></button>{' '}
        <button className="btn-danger so-organizador" onClick={() => window.deletarJogo?.(j.id)}><X size={12} /></button>
      </td>
    </tr>
  );
}

export default function ListaPartidas() {
  const [, setTick] = useState(0);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroCamp, setFiltroCamp] = useState('');
  const [filtroRodada, setFiltroRodada] = useState('');
  const [pagina, setPagina] = useState(1);
  const tableWrapRef = useRef(null);

  // Se conecta com o resto do app: qualquer código antigo que chame renderDados()
  // ou popularFiltroRodada() (nav, salvar/editar/excluir jogo, importar planilha...)
  // continua funcionando, e agora também avisa este componente pra se redesenhar.
  useEffect(() => {
    window.dadosReactRefresh = () => setTick((t) => t + 1);
    window.dadosResetPagina = () => setPagina(1);
    return () => {
      delete window.dadosReactRefresh;
      delete window.dadosResetPagina;
    };
  }, []);

  const jogosCache = window.jogosCache || [];
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const gruposCampeonato = window.gruposCampeonato || ((camps) => camps.map((c) => ({ base: c, itens: [c] })));

  const allCamps = useMemo(() => [...new Set(jogosCache.map((j) => j.camp))], [jogosCache]);

  const { comVariante, soltas } = useMemo(() => {
    const grupos = gruposCampeonato(allCamps);
    return {
      comVariante: grupos.filter((g) => g.itens.length >= 2),
      soltas: sortNatural(grupos.filter((g) => g.itens.length < 2).flatMap((g) => g.itens)),
    };
  }, [allCamps]);

  const rodadas = useMemo(() => {
    const base = filtroCamp ? jogosCache.filter((j) => j.camp === filtroCamp) : jogosCache;
    return sortNatural([...new Set(base.map((j) => j.rodada).filter(Boolean))]);
  }, [jogosCache, filtroCamp]);

  const jogosFiltrados = useMemo(() => {
    let jogos = [...jogosCache];
    const txt = filtroTexto.toLowerCase();
    if (txt) jogos = jogos.filter((j) => j.casa.toLowerCase().includes(txt) || j.vis.toLowerCase().includes(txt) || j.camp.toLowerCase().includes(txt));
    if (filtroCamp) jogos = jogos.filter((j) => j.camp === filtroCamp);
    if (filtroRodada) jogos = jogos.filter((j) => (j.rodada || '') === filtroRodada);
    return jogos;
  }, [jogosCache, filtroTexto, filtroCamp, filtroRodada]);

  const totalPaginas = Math.max(1, Math.ceil(jogosFiltrados.length / TAM_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * TAM_PAGINA;
  const jogosPagina = jogosFiltrados.slice(inicio, inicio + TAM_PAGINA);
  const offsetNumero = jogosFiltrados.length - inicio;

  function irParaPagina(p) {
    setPagina(p);
    requestAnimationFrame(() => tableWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function onChangeTexto(e) { setFiltroTexto(e.target.value); setPagina(1); }
  function onChangeCamp(e) { setFiltroCamp(e.target.value); setFiltroRodada(''); setPagina(1); }
  function onChangeRodada(e) { setFiltroRodada(e.target.value); setPagina(1); }

  const JANELA = 2;
  const botoesPagina = [];
  for (let p = 1; p <= totalPaginas; p++) {
    if (p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= JANELA) {
      botoesPagina.push(
        <button key={p} className={`pg-btn ${p === paginaAtual ? 'ativo' : ''}`} onClick={() => irParaPagina(p)}>{p}</button>
      );
    } else if (Math.abs(p - paginaAtual) === JANELA + 1) {
      botoesPagina.push(<span key={'e' + p} className="pg-info">…</span>);
    }
  }

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FolderOpen size={15} /> Lista de Partidas</div>
      <div className="filtros">
        <div style={{ position: 'relative', flex: 1, minWidth: 120 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto2)', pointerEvents: 'none' }} />
          <input type="text" placeholder="Buscar por time" value={filtroTexto} onChange={onChangeTexto} style={{ width: '100%', paddingLeft: 26 }} />
        </div>
        <select value={filtroCamp} onChange={onChangeCamp}>
          <option value="">Todos os campeonatos</option>
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
        </select>
        <select value={filtroRodada} onChange={onChangeRodada}>
          <option value="">Todas as rodadas</option>
          {rodadas.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="table-wrap" ref={tableWrapRef}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Camp.</th><th>Data</th><th>Rodada</th><th>Local</th><th>Mandante</th><th>Placar</th><th>Visitante</th>
              <th>Rk M</th><th>Rk V</th><th>1ºT</th><th>2ºT</th><th>Chutes</th><th>No Alvo</th><th>Cantos</th><th>Cartões</th><th>Gols (min)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {jogosPagina.length === 0 ? (
              <tr><td colSpan={17}><div className="empty"><div className="icon"><FolderOpen size={28} /></div><p>Nenhum jogo encontrado.</p></div></td></tr>
            ) : (
              jogosPagina.map((j, i) => <LinhaJogo key={j.id} j={j} numero={offsetNumero - i} />)
            )}
          </tbody>
        </table>
      </div>

      {jogosFiltrados.length > 0 && (
        <div className="paginacao">
          <div className="pg-info" style={{ width: '100%', textAlign: 'center', marginBottom: 6 }}>
            Mostrando {inicio + 1}–{Math.min(inicio + TAM_PAGINA, jogosFiltrados.length)} de {jogosFiltrados.length} jogo(s)
          </div>
          <button className="pg-btn" disabled={paginaAtual <= 1} onClick={() => irParaPagina(paginaAtual - 1)}>‹ Anterior</button>
          {botoesPagina}
          <button className="pg-btn" disabled={paginaAtual >= totalPaginas} onClick={() => irParaPagina(paginaAtual + 1)}>Próximo ›</button>
        </div>
      )}
    </div>
  );
}
