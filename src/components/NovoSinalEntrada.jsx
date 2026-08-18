import { useState } from 'react';
import { Trophy, Swords, Flag, Clock, Plus, Shield, Calendar, CheckSquare, Square, ListChecks } from 'lucide-react';

// ══ Novo Sinal de Entrada (sub-aba dentro de Partidas) — reformulado ══
//
// Antes esse formulário juntava tudo (Campeonato/Jogo/Rodada/Horário +
// Mercado/Minuto/Odd/Situação/Análise) numa entrada só, de um jogo por vez.
// Agora ele cuida só de CADASTRAR o jogo (de onde vai jogar). Mercado, Odd,
// Minuto e Situação viraram edição posterior, feita direto no card do
// Dashboard (ícone de editar) — public/js/11-jogosdodia.js.
//
// Dois jeitos de cadastrar:
//  1) Buscar pela API-Football, marcar quantos jogos quiser (checkbox) e
//     adicionar todos de uma vez ("Adicionar Selecionados").
//  2) Preencher Campeonato/Jogo/Rodada/Horário manualmente e clicar
//     "Adicionar Jogo" — pra times/campeonatos que a API não cobre.
//
// Pontes com o restante do app, que ainda é JS puro:
//   - window.jogosCache      → array de jogos (times/campeonatos disponíveis)
//   - window.ophLoad / ophSave → lista "Jogos de Hoje" (localStorage)
//   - window.ophRenderLista  → redesenha os cards de "Jogos de Hoje" (Dashboard)
//   - window.renderGeral     → atualiza o Dashboard depois de adicionar um jogo
//   - window.toast / escudoImgOuIcone / sortNatural / comEspeciaisPorUltimo

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function SectionLabel({ icon: Icon, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <Icon size={13} style={{ flexShrink: 0 }} />
      {children}
    </label>
  );
}

function normalizaRodada(r) {
  return r ? String(r).replace(/^Regular Season - /i, 'Rodada ') : '';
}

export default function NovoSinalEntrada() {
  const [camp, setCamp] = useState('');
  const [casa, setCasa] = useState('');
  const [vis, setVis] = useState('');
  const [rodada, setRodada] = useState('');
  const [data, setData] = useState(window.hojeBR ? window.hojeBR() : new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState('');
  const [min, setMin] = useState('');

  // ── API-Football: busca os jogos de hoje e deixa marcar quantos quiser ──
  const [buscandoApi, setBuscandoApi] = useState(false);
  const [jogosApi, setJogosApi] = useState(null); // null = ainda não buscou
  const [selecionadosApi, setSelecionadosApi] = useState(new Set());
  const [extra, setExtra] = useState({ camp: '' }); // campeonato vindo da API que ainda não existe no histórico

  async function buscarJogos() {
    setBuscandoApi(true);
    setJogosApi(null);
    setSelecionadosApi(new Set());
    try {
      const resp = await fetch(`/.netlify/functions/jogos-do-dia?data=${data}`);
      const json = await resp.json();
      if (json.erro) { window.toast?.('' + json.erro); setJogosApi([]); return; }
      setJogosApi(json.jogos || []);
      if (!json.jogos?.length) window.toast?.('Nenhum jogo encontrado nessa data, nas ligas configuradas');
    } catch (e) {
      window.toast?.('Erro ao buscar jogos da API');
      setJogosApi([]);
    } finally {
      setBuscandoApi(false);
    }
  }

  function toggleSelecaoApi(idx) {
    setSelecionadosApi((prev) => {
      const novo = new Set(prev);
      if (novo.has(idx)) novo.delete(idx); else novo.add(idx);
      return novo;
    });
  }

  function selecionarTodosApi() {
    if (!jogosApi) return;
    setSelecionadosApi(selecionadosApi.size === jogosApi.length ? new Set() : new Set(jogosApi.map((_, i) => i)));
  }

  async function adicionarSelecionadosApi() {
    if (!jogosApi || !selecionadosApi.size) { window.toast?.('Marque pelo menos um jogo pra adicionar'); return; }
    const escolhidos = jogosApi.filter((_, i) => selecionadosApi.has(i));
    let ok = 0, duplicados = 0, erros = 0;
    for (const j of escolhidos) {
      const resultado = await window.inserirJogoAgendadoNuvem({
        camp: j.campeonato, casa: j.casa, vis: j.vis,
        rodada: normalizaRodada(j.rodada), data, horario: j.horario || '',
        mercado: '', minuto: '', odd: '', status: 'aguardando',
      });
      if (resultado === 'duplicado') duplicados++;
      else if (resultado === 'erro') erros++;
      else ok++;
    }
    setJogosApi(null);
    setSelecionadosApi(new Set());
    await window.ophCarregarNuvem?.();
    window.ophRenderLista?.();
    window.renderGeral?.();
    const partes = [];
    if (ok) partes.push(`${ok} jogo(s) adicionado(s)`);
    if (duplicados) partes.push(`${duplicados} já estava(m) na lista`);
    if (erros) partes.push(`${erros} com erro`);
    window.toast?.(partes.join(' · ') || 'Nada adicionado', !ok && (duplicados || erros) > 0);
  }

  const jogosCache = window.jogosCache || [];
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const especiais = window.comEspeciaisPorUltimo;

  const allCamps = sortNatural([...new Set([...jogosCache.map((j) => j.camp), ...(extra.camp ? [extra.camp] : [])])]);
  const listaCamps = especiais ? especiais(allCamps) : allCamps;

  const jogosDoCamp = camp ? jogosCache.filter((j) => j.camp === camp) : jogosCache;
  const times = [...new Set([...jogosDoCamp.map((j) => j.casa), ...jogosDoCamp.map((j) => j.vis)])].sort();

  function onChangeCamp(novoCamp) {
    setCamp(novoCamp);
    const jogos = novoCamp ? jogosCache.filter((j) => j.camp === novoCamp) : jogosCache;
    const timesNovos = [...new Set([...jogos.map((j) => j.casa), ...jogos.map((j) => j.vis)])];
    if (casa && !timesNovos.includes(casa)) setCasa('');
    if (vis && !timesNovos.includes(vis)) setVis('');
  }

  function adicionar() {
    if (!casa || !vis) { window.toast?.('Selecione os dois times'); return; }
    const horario = hora && min ? `${hora}:${min}` : '';

    window.inserirJogoAgendadoNuvem({ camp, casa, vis, rodada: rodada.trim(), data, horario, mercado: '', minuto: '', odd: '', status: 'aguardando' })
      .then(async (resultado) => {
        if (resultado === 'duplicado') { window.toast?.('Esse jogo já está na lista (mesmo confronto, mesma data)', true); return; }
        if (resultado === 'erro') { window.toast?.('Erro ao adicionar jogo', true); return; }

        // Limpa só os times/rodada/horário — mantém campeonato e data (comum
        // adicionar vários jogos seguidos do mesmo campeonato/dia)
        setRodada(''); setHora(''); setMin(''); setCasa(''); setVis('');

        await window.ophCarregarNuvem?.();
        window.ophRenderLista?.();
        window.renderGeral?.();
        window.toast?.(data === (window.hojeBR?.() || data) ? 'Jogo adicionado' : `Jogo agendado para ${window.fd ? window.fd(data) : data}`);
      });
  }

  const escudoCasaHtml = window.escudoImgOuIcone ? window.escudoImgOuIcone(casa) : null;
  const escudoVisHtml = window.escudoImgOuIcone ? window.escudoImgOuIcone(vis) : null;

  return (
    <div className="card">
      {/* O título "Oportunidade" já aparece na sub-aba logo acima — não precisa repetir aqui dentro */}

      <div style={{ marginBottom: 14 }}>
        <SectionLabel icon={Calendar}>Data</SectionLabel>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <button
          type="button"
          onClick={buscarJogos}
          disabled={buscandoApi}
          className="btn"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Swords size={13} />
          {buscandoApi
            ? 'Buscando jogos…'
            : data === (window.hojeBR ? window.hojeBR() : data)
              ? 'Buscar jogos de hoje'
              : `Buscar jogos de ${window.fd ? window.fd(data) : data}`}
        </button>

        {jogosApi && jogosApi.length > 0 && (
          <>
            <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--c3)', borderRadius: 10 }}>
              {jogosApi.map((j, i) => {
                const sel = selecionadosApi.has(i);
                return (
                  <div
                    key={j.id ?? i}
                    onClick={() => toggleSelecaoApi(i)}
                    style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--c3)', display: 'flex', alignItems: 'center', gap: 8, background: sel ? 'var(--c2-dest)' : 'transparent' }}
                  >
                    {sel ? <CheckSquare size={16} style={{ color: 'var(--verde2)', flexShrink: 0 }} /> : <Square size={16} style={{ color: 'var(--texto2)', flexShrink: 0 }} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{j.campeonato} · {j.horario}</div>
                      <div style={{ fontWeight: 600 }}>{j.casa} × {j.vis}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={selecionarTodosApi} className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}>
                <ListChecks size={13} /> {selecionadosApi.size === jogosApi.length ? 'Limpar seleção' : 'Marcar todos'}
              </button>
              <button type="button" onClick={adicionarSelecionadosApi} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}>
                <Plus size={13} /> Adicionar {selecionadosApi.size > 0 ? `(${selecionadosApi.size})` : 'selecionados'}
              </button>
            </div>
          </>
        )}
        {jogosApi && jogosApi.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Nenhum jogo encontrado pra hoje nas ligas configuradas.</div>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--c3)', margin: '4px 0 14px' }} />
      <div style={{ fontSize: 11, color: 'var(--texto2)', marginBottom: 10 }}>Ou cadastre um jogo manualmente:</div>

      <div style={{ marginBottom: 10 }}>
        <SectionLabel icon={Trophy}>Campeonato</SectionLabel>
        <select value={camp} onChange={(e) => onChangeCamp(e.target.value)}>
          <option value="">— Selecione o campeonato —</option>
          {listaCamps.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <SectionLabel icon={Swords}>Jogo</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div className="escudo-sel" style={{ width: 30, height: 30, fontSize: 15, flexShrink: 0 }}>
            {escudoCasaHtml ? <span dangerouslySetInnerHTML={{ __html: escudoCasaHtml }} /> : <Shield size={16} />}
          </div>
          <select value={casa} onChange={(e) => setCasa(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
            <option value="">— Mandante —</option>
            {times.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Swords size={14} style={{ color: 'var(--texto2)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <select value={vis} onChange={(e) => setVis(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
            <option value="">— Visitante —</option>
            {times.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="escudo-sel" style={{ width: 30, height: 30, fontSize: 15, flexShrink: 0 }}>
            {escudoVisHtml ? <span dangerouslySetInnerHTML={{ __html: escudoVisHtml }} /> : <Shield size={16} />}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div>
          <SectionLabel icon={Flag}>Rodada</SectionLabel>
          <input type="text" value={rodada} onChange={(e) => setRodada(e.target.value)} placeholder="Ex: Rodada 19" />
        </div>
        <div>
          <SectionLabel icon={Clock}>Horário</SectionLabel>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select value={hora} onChange={(e) => setHora(e.target.value)} style={{ flex: 1, padding: '9px 4px' }}>
              <option value=""></option>
              {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <span style={{ fontWeight: 800 }}>:</span>
            <select value={min} onChange={(e) => setMin(e.target.value)} style={{ flex: 1, padding: '9px 4px' }}>
              <option value=""></option>
              {MINUTOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      <button className="btn-primary" onClick={adicionar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Plus size={15} /> Adicionar Jogo
      </button>
    </div>
  );
}
