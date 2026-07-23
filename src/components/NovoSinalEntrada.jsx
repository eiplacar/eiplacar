import { useState } from 'react';
import { Trophy, Swords, Flag, Clock, TrendingUp, Timer, DollarSign, CircleDot, FileText, Lightbulb, Eye, Plus, Shield, BarChart3 } from 'lucide-react';

// ══ Novo Sinal de Entrada (sub-aba dentro de Partidas) — quinto módulo migrado para React ══
//
// Antes era JS puro em public/js/11-jogosdodia.js (funções ophXxx). A lista
// "Jogos de Hoje" (localStorage + expiração automática) continua JS puro,
// já que é compartilhada com o Dashboard — este componente só lê/escreve nela
// através das mesmas funções de sempre.
//
// Pontes com o restante do app, que ainda é JS puro:
//   - window.jogosCache      → array de jogos (times/campeonatos disponíveis)
//   - window.ultimaAnalise   → preenchido pela aba Análise
//   - window.ophLoad / ophSave / ophExpirado → lista "Jogos de Hoje" (localStorage)
//   - window.ophRenderLista  → redesenha os cards de "Jogos de Hoje" (Dashboard)
//   - window.renderGeral     → atualiza o Dashboard depois de adicionar um jogo
//   - window.toast / escudoImgOuIcone / sortNatural / gruposCampeonato

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const ROTULO_STATUS = {
  aguardando: '🟡 Aguardando resultado',
  green: '✅ Green',
  red: '❌ Red',
  void: '↩️ Void',
  encerrado: '⚫ Encerrado',
};

function fmtDataHoraAgora() {
  const agora = new Date();
  const dataFmt = String(agora.getDate()).padStart(2, '0') + '/' + String(agora.getMonth() + 1).padStart(2, '0') + '/' + agora.getFullYear();
  const horaFmt = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  return { dataFmt, horaFmt };
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <Icon size={13} style={{ flexShrink: 0 }} />
      {children}
    </label>
  );
}

export default function NovoSinalEntrada() {
  const [camp, setCamp] = useState('');
  const [casa, setCasa] = useState('');
  const [vis, setVis] = useState('');
  const [rodada, setRodada] = useState('');
  const [hora, setHora] = useState('');
  const [min, setMin] = useState('');
  const [mercado, setMercado] = useState('');
  const [minutoEntrada, setMinutoEntrada] = useState('');
  const [odd, setOdd] = useState('');
  const [status, setStatus] = useState('aguardando');
  const [placar, setPlacar] = useState('');
  const [analise, setAnalise] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [mercadoSugeridoIdx, setMercadoSugeridoIdx] = useState('');

  const jogosCache = window.jogosCache || [];
  const sortNatural = window.sortNatural || ((arr) => [...arr].sort());
  const gruposCampeonato = window.gruposCampeonato || ((camps) => camps.map((c) => ({ base: c, itens: [c] })));
  const ultimaAnalise = window.ultimaAnalise;

  const allCamps = sortNatural([...new Set(jogosCache.map((j) => j.camp))]);
  const grupos = gruposCampeonato(allCamps);
  const comVariante = grupos.filter((g) => g.itens.length >= 2);
  const soltas = sortNatural(grupos.filter((g) => g.itens.length < 2).flatMap((g) => g.itens));

  const jogosDoCamp = camp ? jogosCache.filter((j) => j.camp === camp) : jogosCache;
  const times = [...new Set([...jogosDoCamp.map((j) => j.casa), ...jogosDoCamp.map((j) => j.vis)])].sort();

  const mercadoLower = mercado.toLowerCase();
  const placarLabel = mercadoLower.includes('canto') ? 'Total de Cantos' : mercadoLower.includes('cart') ? 'Total de Cartões' : 'Placar Final';
  const placarPlaceholder = mercadoLower.includes('canto') ? 'Ex: 9' : mercadoLower.includes('cart') ? 'Ex: 5' : 'Ex: 2 x 1';

  function onChangeCamp(novoCamp) {
    setCamp(novoCamp);
    const jogos = novoCamp ? jogosCache.filter((j) => j.camp === novoCamp) : jogosCache;
    const timesNovos = [...new Set([...jogos.map((j) => j.casa), ...jogos.map((j) => j.vis)])];
    if (casa && !timesNovos.includes(casa)) setCasa('');
    if (vis && !timesNovos.includes(vis)) setVis('');
  }

  function sugerirAnalise() {
    if (!ultimaAnalise) { window.toast?.('⚠️ Faça uma análise primeiro na aba 🔍 Análise'); return; }
    const mercadoAtual = mercado.trim();

    if (mercadoAtual) {
      const m = ultimaAnalise.mercados.find((x) => x.nome.toLowerCase() === mercadoAtual.toLowerCase());
      if (!m) { window.toast?.(`⚠️ Esse mercado não está na última análise (${ultimaAnalise.casa} × ${ultimaAnalise.vis})`); return; }
      setAnalise(`Segundo a análise, ${m.nome} tem ${m.prob}% de chance.`);
      window.toast?.('💡 Análise sugerida!');
      return;
    }

    if (!ultimaAnalise.mercados?.length) { window.toast?.('⚠️ A última análise não tem mercados calculados'); return; }
    setMostrarSugestoes(true);
    window.toast?.(`📊 Escolha um mercado da última análise (${ultimaAnalise.casa} × ${ultimaAnalise.vis})`);
  }

  function escolherMercadoSugerido(idx) {
    setMercadoSugeridoIdx(idx);
    if (idx === '') return;
    const m = ultimaAnalise?.mercados?.[parseInt(idx, 10)];
    if (!m) return;
    setMercado(m.nome);
    setAnalise(`Segundo a análise, ${m.nome} tem ${m.prob}% de chance.`);
    setMostrarSugestoes(false);
    setMercadoSugeridoIdx('');
    if (!casa && times.includes(ultimaAnalise.casa)) setCasa(ultimaAnalise.casa);
    if (!vis && times.includes(ultimaAnalise.vis)) setVis(ultimaAnalise.vis);
    window.toast?.('💡 Mercado e análise preenchidos!');
  }

  function adicionar() {
    if (!casa || !vis) { window.toast?.('⚠️ Selecione os dois times'); return; }
    const horario = hora && min ? `${hora}:${min}` : '';
    const ophLoad = window.ophLoad || (() => []);
    const ophSave = window.ophSave || (() => {});

    const lista = ophLoad();
    lista.push({
      id: Date.now(), camp, casa, vis, rodada: rodada.trim(), horario,
      mercado: mercado.trim(), minuto: minutoEntrada, odd, status,
      placar: placar.trim(), analise: analise.trim(), criadoEm: new Date().toISOString(),
    });
    ophSave(lista);

    // Limpa o formulário pra montar o próximo sinal
    setRodada(''); setHora(''); setMin(''); setCasa(''); setVis('');
    setMercado(''); setMinutoEntrada(''); setOdd(''); setStatus('aguardando');
    setPlacar(''); setAnalise(''); setMostrarSugestoes(false);

    window.ophRenderLista?.();
    window.renderGeral?.();
    window.toast?.('✅ Jogo adicionado à lista de hoje');
  }

  const escudoCasaHtml = window.escudoImgOuIcone ? window.escudoImgOuIcone(casa) : null;
  const escudoVisHtml = window.escudoImgOuIcone ? window.escudoImgOuIcone(vis) : null;

  // Preview ao vivo — mesmo texto usado no compartilhamento da lista
  let preview = 'Preencha os campos acima para ver o preview.';
  if (casa || vis || mercado) {
    const horario = hora && min ? `${hora}:${min}` : '';
    const { dataFmt, horaFmt } = fmtDataHoraAgora();
    preview = [
      camp ? `🏆 Campeonato: ${camp}` : null,
      casa || vis ? `⚽ ${casa || '—'} 🆚 ${vis || '—'}` : null,
      rodada ? `🏟️ Rodada: ${rodada}` : null,
      horario ? `🕒 Horário: ${horario}` : null,
      mercado ? `📈 Mercado: ${mercado}` : null,
      minutoEntrada ? `⏱ Entrada: ${minutoEntrada}'` : null,
      odd ? `💰 Odd: ${parseFloat(odd).toFixed(2)}` : null,
      `🟡 Situação: ${ROTULO_STATUS[status] || ROTULO_STATUS.aguardando}`,
      analise ? `📝 Análise:\n${analise}` : null,
      `━━━━━━━━━━━━━━━━━━`,
      `📅 Publicado em:\n${dataFmt} às ${horaFmt}`,
      ``,
      `📲 Ei Placar`,
    ].filter((l) => l !== null).join('\n');
  }

  return (
    <div className="card">
      {/* O título "Oportunidade" já aparece na sub-aba logo acima — não precisa repetir aqui dentro */}

      <div style={{ marginBottom: 10 }}>
        <SectionLabel icon={Trophy}>Campeonato</SectionLabel>
        <select value={camp} onChange={(e) => onChangeCamp(e.target.value)}>
          <option value="">— Selecione o campeonato —</option>
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

      <div style={{ height: 1, background: 'var(--c3)', margin: '4px 0 14px' }} />

      <div style={{ marginBottom: 8 }}>
        <SectionLabel icon={TrendingUp}>Mercado</SectionLabel>
        <input type="text" value={mercado} onChange={(e) => setMercado(e.target.value)} placeholder="Ex: Over 1.5" />
      </div>
      {mostrarSugestoes && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={12} /> Mercados da última análise</label>
          <select value={mercadoSugeridoIdx} onChange={(e) => escolherMercadoSugerido(e.target.value)}>
            <option value="">— Selecione —</option>
            {ultimaAnalise?.mercados?.map((m, i) => <option key={i} value={i}>{m.nome} — {m.prob}%</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <SectionLabel icon={Timer}>Minuto da Entrada</SectionLabel>
          <input type="number" min="0" max="120" value={minutoEntrada} onChange={(e) => setMinutoEntrada(e.target.value)} placeholder="Ex: 33" />
        </div>
        <div>
          <SectionLabel icon={DollarSign}>Odd</SectionLabel>
          <input type="number" min="1.01" step="0.01" value={odd} onChange={(e) => setOdd(e.target.value)} placeholder="1.80" />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <SectionLabel icon={CircleDot}>Situação</SectionLabel>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="aguardando">🟡 Aguardando resultado</option>
          <option value="green">✅ Green</option>
          <option value="red">❌ Red</option>
          <option value="void">↩️ Void</option>
          <option value="encerrado">⚫ Encerrado</option>
        </select>
      </div>
      {status !== 'aguardando' && (
        <div style={{ marginBottom: 8 }}>
          <label>{placarLabel}</label>
          <input type="text" value={placar} onChange={(e) => setPlacar(e.target.value)} placeholder={placarPlaceholder} />
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <SectionLabel icon={FileText}>Análise</SectionLabel>
        <textarea rows={2} value={analise} onChange={(e) => setAnalise(e.target.value)} placeholder="Ex: Jogo intenso, muitas finalizações e pressão ofensiva." />
      </div>
      <button
        type="button"
        onClick={sugerirAnalise}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--c1)', border: '1px dashed var(--c3)', borderRadius: 8, padding: 8, color: 'var(--texto2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}
      >
        <Lightbulb size={13} /> Sugerir análise
      </button>

      <div style={{ height: 1, background: 'var(--c3)', margin: '4px 0 14px' }} />

      <SectionLabel icon={Eye}>Modelo final</SectionLabel>
      <pre style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 9, padding: 12, fontSize: 11, color: 'var(--texto2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.6, margin: '0 0 14px' }}>
        {preview}
      </pre>

      <button className="btn-primary" onClick={adicionar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Plus size={15} /> Adicionar Jogo
      </button>
    </div>
  );
}
