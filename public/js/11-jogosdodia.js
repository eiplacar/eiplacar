// ═══════════════════════════════════════════════════
// ABA OPORTUNIDADES — card único: monta um "Sinal de Entrada" e adiciona
// à lista "Jogos de Hoje" (aparece aqui e também no Dashboard). Cada jogo
// some sozinho da lista 4 horas depois do horário marcado.
// ═══════════════════════════════════════════════════
const OPH_KEY = 'eiPlacar_jogosHoje_v1';
function ophLoad(){
  try { return JSON.parse(localStorage.getItem(OPH_KEY)) || []; }
  catch { return []; }
}
function ophSave(lista){
  localStorage.setItem(OPH_KEY, JSON.stringify(lista));
}
function ophExpirado(j){
  if(!j.horario) return false;
  const [h,m] = j.horario.split(':').map(Number);
  if(isNaN(h)||isNaN(m)) return false;
  const criado = j.criadoEm ? new Date(j.criadoEm) : new Date();
  const base = new Date(criado.getFullYear(), criado.getMonth(), criado.getDate(), h, m, 0, 0);
  const limite = new Date(base.getTime() + 4*60*60*1000); // 4h depois do horário do jogo
  return new Date() > limite;
}


// Os campos do formulário (Campeonato/Times/Rodada/Horário/Mercado/Situação/Análise)
// agora são React puro: src/components/NovoSinalEntrada.jsx. As funções que sobraram
// aqui (ophLoad/ophSave/ophExpirado/ophRotuloStatus) são a ponte pra ele, e o resto
// deste arquivo cuida só da lista "Jogos de Hoje" (Dashboard).
function ophRotuloStatus(status){
  return { aguardando:'🟡 Aguardando resultado', green:'✅ Green', red:'❌ Red', void:'↩️ Void', encerrado:'⚫ Encerrado' }[status] || '🟡 Aguardando resultado';
}

function ophRemover(id){
  ophSave(ophLoad().filter(j=>j.id!==id));
  ophSelecionados.delete(id);
  ophRenderLista();
  renderGeral();
}

// Ids marcados pra compartilhar (toque no card pra marcar/desmarcar). Fica só na memória
// da sessão — assim, se um jogo já foi compartilhado, ele não vem marcado de novo sozinho.
let ophSelecionados = new Set();
function ophToggleSelecao(id){
  if(ophSelecionados.has(id)) ophSelecionados.delete(id); else ophSelecionados.add(id);
  ophRenderLista();
}

// ══ Renderiza a lista "Jogos de Hoje" — na aba Oportunidades E no Dashboard ══
function ophRenderLista(){
  let lista = ophLoad();
  const antes = lista.length;
  lista = lista.filter(j=>!ophExpirado(j)); // some sozinho 4h depois do horário
  if(lista.length !== antes) ophSave(lista);
  lista.sort((a,b)=>(a.horario||'99:99').localeCompare(b.horario||'99:99'));

  // Limpa seleção de jogos que não existem mais (removidos ou expirados)
  const idsAtuais = new Set(lista.map(j=>j.id));
  [...ophSelecionados].forEach(id=>{ if(!idsAtuais.has(id)) ophSelecionados.delete(id); });

  const html = lista.map(j=>{
    const sel = ophSelecionados.has(j.id);
    return `
    <div onclick="ophToggleSelecao(${j.id})" style="flex:0 0 auto;width:140px;background:var(--c2);border:2px solid ${sel?'var(--verde2)':'var(--c3)'};border-radius:10px;padding:10px;text-align:center;position:relative;cursor:pointer">
      ${sel?'<div style="position:absolute;top:4px;left:4px;width:16px;height:16px;border-radius:50%;background:var(--verde2);color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1">✓</div>':''}
      <button onclick="event.stopPropagation();ophRemover(${j.id})" style="position:absolute;top:2px;right:4px;background:none;border:none;color:var(--texto2);font-size:13px;cursor:pointer;padding:2px 4px">✕</button>
      <div style="width:30px;height:30px;margin:0 auto">${escudoImgOuIcone(j.casa)}</div>
      <div style="font-size:10.5px;font-weight:700;line-height:1.2;margin-top:2px">${j.casa||'—'}</div>
      <div style="font-size:9px;color:var(--texto2);margin:3px 0">🆚</div>
      <div style="width:30px;height:30px;margin:0 auto">${escudoImgOuIcone(j.vis)}</div>
      <div style="font-size:10.5px;font-weight:700;line-height:1.2;margin-top:2px">${j.vis||'—'}</div>
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--c3);font-size:9px;color:var(--ouro);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🏆 ${j.camp||'—'}</div>
      <div style="font-size:9px;color:var(--texto2);margin-top:2px">${[j.horario?('🕘 '+j.horario):null, j.rodada||null].filter(Boolean).join(' • ')||'—'}</div>
    </div>`;
  }).join('');

  const vazio = `<div style="color:var(--texto2);font-size:12px;padding:10px">Nenhum jogo adicionado ainda.</div>`;
  ['ophListaDash'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = html || vazio;
  });
  ['ophListaTituloDash'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = `📋 Jogos de Hoje (${lista.length})`;
  });
  const btnShare = document.getElementById('ophBtnCompartilharDash');
  if(btnShare) btnShare.style.display = ophSelecionados.size ? 'flex' : 'none';
  // No Dashboard, o card só some quando a lista tá vazia; renderGeral() decide se ele
  // deve ficar escondido por outro motivo (ex: já tá dentro de um campeonato específico).
  const cardDash = document.getElementById('ophListaCardDash');
  if(cardDash && document.getElementById('geralCampSelecionado')?.style.display!=='block'){
    cardDash.style.display = lista.length ? 'block' : 'none';
  }
}

// ══ Compartilha só os jogos marcados (toque no card pra marcar) ══
function ophCompartilharSelecionados(){
  const lista = ophLoad().filter(j=>!ophExpirado(j) && ophSelecionados.has(j.id)).sort((a,b)=>(a.horario||'99:99').localeCompare(b.horario||'99:99'));
  if(!lista.length){ toast('⚠️ Toque nos jogos que quer compartilhar primeiro'); return; }

  const agora = new Date();
  const dataFmt = String(agora.getDate()).padStart(2,'0')+'/'+String(agora.getMonth()+1).padStart(2,'0')+'/'+agora.getFullYear();
  const horaFmt = String(agora.getHours()).padStart(2,'0')+':'+String(agora.getMinutes()).padStart(2,'0');

  const blocos = lista.map(j=>[
    j.camp ? `🏆 Campeonato: ${j.camp}` : null,
    `⚽ ${j.casa} 🆚 ${j.vis}`,
    j.rodada ? `🏟️ Rodada: ${j.rodada}` : null,
    j.horario ? `🕒 Horário: ${j.horario}` : null,
    j.mercado ? `📈 Mercado: ${j.mercado}` : null,
    j.minuto ? `⏱ Entrada: ${j.minuto}'` : null,
    j.odd ? `💰 Odd: ${parseFloat(j.odd).toFixed(2)}` : null,
    `🟡 Situação: ${ophRotuloStatus(j.status)}`,
    j.analise ? `📝 Análise:\n${j.analise}` : null,
  ].filter(l=>l!==null).join('\n'));

  const titulo = lista.length===1 ? `${lista[0].casa} × ${lista[0].vis}` : 'Jogos de Hoje';
  const txt = [
    ...blocos,
  ].join('\n\n━━━━━━━━━━━━━━━━━━\n\n') + `\n\n━━━━━━━━━━━━━━━━━━\n\n📅 Publicado em:\n${dataFmt} às ${horaFmt}\n\n📲 Ei Placar`;

  abrirCompartilhamento(txt.trim(), titulo);
  ophSelecionados.clear(); // já foram enviados — some a marcação pra não mandar de novo sem querer
  ophRenderLista();
}

// Atualiza a lista sozinho de tempos em tempos, pra sumir os jogos vencidos (4h após o horário) sem precisar recarregar a página
ophRenderLista();
setInterval(ophRenderLista, 60000);
