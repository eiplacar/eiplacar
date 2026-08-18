// ═══════════════════════════════════════════════════
// ABA OPORTUNIDADES — card único: monta um "Sinal de Entrada" e adiciona
// à lista "Jogos de Hoje" (aparece aqui e também no Dashboard). Cada jogo
// some sozinho da lista 4 horas depois do horário marcado.
// ═══════════════════════════════════════════════════
// A lista "Jogos Agendados" agora é COMPARTILHADA entre todas as contas — fica
// na tabela `jogos_agendados` do Supabase (supabase/11-jogos-agendados.sql),
// não mais em localStorage. Jogo adicionado por um organizador aparece pra
// todo mundo; apagado, some pra todo mundo também.
//
// Permissões (reforçadas na tela E no banco via RLS — ver o .sql acima):
//   • Organizador: adiciona, apaga e edita qualquer campo.
//   • Membro: só compartilha e edita Mercado/Minuto/Odd/Situação (não mexe
//     em Campeonato/Times/Data/Horário, e não apaga jogo).
let ophCache = [];

// Busca a lista inteira na nuvem. Chamado no carregamento e a cada 60s
// (mesmo intervalo de antes), pra qualquer conta enxergar jogo novo/apagado
// por outra pessoa sem precisar recarregar a página.
async function ophCarregarNuvem(){
  if (typeof temConfig !== 'function' || !temConfig()) return;
  try {
    const res = await fetch(sbUrlAgendados('?order=data.asc,horario.asc'), { headers: sbHeaders() });
    if(!res.ok) return; // sem toast aqui — isso roda sozinho em background a cada minuto
    ophCache = await res.json();
  } catch { /* falha silenciosa — tenta de novo no próximo ciclo */ }
}

function ophExpirado(j){
  if(!j.horario) return false;
  const [h,m] = j.horario.split(':').map(Number);
  if(isNaN(h)||isNaN(m)) return false;
  let base;
  if(j.data){
    const [y,mo,d] = j.data.split('-').map(Number);
    base = new Date(y, mo-1, d, h, m, 0, 0);
  } else {
    const criado = j.criado_em ? new Date(j.criado_em) : new Date();
    base = new Date(criado.getFullYear(), criado.getMonth(), criado.getDate(), h, m, 0, 0);
  }
  const limite = new Date(base.getTime() + 4*60*60*1000); // 4h depois do horário do jogo
  return new Date() > limite;
}

function ophRotuloStatus(status){
  return { aguardando:'🟡 Aguardando resultado', green:'✅ Green', red:'❌ Red', void:'↩️ Void', encerrado:'⚫ Encerrado' }[status] || '🟡 Aguardando resultado';
}

// Adiciona jogo na lista compartilhada (chamado por NovoSinalEntrada.jsx — a
// tela de cadastro, que só o organizador acessa). Trava duplicidade em dois
// níveis: o índice único no banco recusa (23505) e aqui a gente traduz isso
// pra "já está na lista" em vez de mostrar erro técnico.
// Retorna: o registro inserido | 'duplicado' | 'erro'
async function inserirJogoAgendadoNuvem(jogo){
  try {
    const res = await fetch(sbUrlAgendados(), {
      method:'POST',
      headers: { ...sbHeaders(), 'Prefer':'return=representation' },
      body: JSON.stringify(jogo)
    });
    if(!res.ok){
      const texto = await res.text();
      if(res.status===409 || /duplicate key|unique constraint/i.test(texto)) return 'duplicado';
      console.error('Erro ao inserir jogo agendado:', texto);
      return 'erro';
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch(e){
    console.error('Erro ao inserir jogo agendado:', e);
    return 'erro';
  }
}
window.inserirJogoAgendadoNuvem = inserirJogoAgendadoNuvem;
window.ophCarregarNuvem = ophCarregarNuvem;
window.ophRenderLista = ophRenderLista;
// Compatibilidade com 07-geral.js (Resumo do Dashboard, selo de jogo-hoje por
// campeonato) — ele lê a lista de forma síncrona; ophCache já fica atualizado
// em segundo plano (ophCarregarNuvem roda no load e a cada 60s).
window.ophLoad = () => ophCache;
window.ophExpirado = ophExpirado;

// Apagar jogo é só pra organizador — o botão ✕ já só aparece pra organizador
// (checado abaixo em ophRenderLista), isso aqui é uma segunda trava, e o RLS no
// banco é a trava de verdade (mesmo que alguém force a chamada, o Supabase recusa).
async function ophRemover(id){
  if(!perfilAtual || perfilAtual.papel !== 'organizador'){ toast?.('Só o organizador pode apagar jogos'); return; }
  const antes = ophCache.slice();
  ophCache = ophCache.filter(j=>j.id!==id); // otimista — some da tela na hora
  ophSelecionados.delete(id);
  ophRenderLista();
  try {
    const res = await fetch(sbUrlAgendados('?id=eq.'+id), { method:'DELETE', headers: sbHeaders() });
    if(!res.ok) throw new Error(await res.text());
    renderGeral();
  } catch(e){
    ophCache = antes; // desfaz se der erro
    ophRenderLista();
    toast?.('Erro ao apagar: ' + e.message, true);
  }
}

// ══ Edição do card (ícone ✏️, só aparece quando o card tá selecionado) ══
// Organizador edita tudo. Membro só edita Mercado/Minuto/Odd/Situação — os
// campos de cima (Campeonato/Times/Data/Horário) ficam travados na tela.
let ophEditandoId = null;
function ophAbrirEdicao(id){
  const j = ophCache.find(x=>x.id===id);
  if(!j) return;
  ophEditandoId = id;
  const souOrganizador = perfilAtual && perfilAtual.papel === 'organizador';

  document.getElementById('ophEditCamp').value = j.camp||'';
  document.getElementById('ophEditCasa').value = j.casa||'';
  document.getElementById('ophEditVis').value = j.vis||'';
  document.getElementById('ophEditData').value = j.data || (window.hojeBR ? window.hojeBR() : '');
  document.getElementById('ophEditHorario').value = j.horario||'';
  document.getElementById('ophEditMercado').value = j.mercado||'';
  document.getElementById('ophEditMinuto').value = j.minuto||'';
  document.getElementById('ophEditOdd').value = j.odd||'';
  document.getElementById('ophEditStatus').value = j.status||'aguardando';

  // Campos de cima (identidade do jogo) só o organizador mexe
  ['ophEditCamp','ophEditCasa','ophEditVis','ophEditData','ophEditHorario'].forEach(elId=>{
    const el = document.getElementById(elId);
    if(el) el.disabled = !souOrganizador;
  });
  const avisoMembro = document.getElementById('ophEditAvisoMembro');
  if(avisoMembro) avisoMembro.style.display = souOrganizador ? 'none' : 'block';

  document.getElementById('modalEditarOportunidade').classList.add('open');
}
function ophFecharEdicao(){
  document.getElementById('modalEditarOportunidade').classList.remove('open');
  ophEditandoId = null;
}
async function ophSalvarEdicao(){
  if(ophEditandoId==null) return;
  const j = ophCache.find(x=>x.id===ophEditandoId);
  if(!j){ ophFecharEdicao(); return; }
  const souOrganizador = perfilAtual && perfilAtual.papel === 'organizador';

  // Mercado/Minuto/Odd/Situação — todo mundo pode mandar
  const campos = {
    mercado: document.getElementById('ophEditMercado').value.trim(),
    minuto: document.getElementById('ophEditMinuto').value,
    odd: document.getElementById('ophEditOdd').value,
    status: document.getElementById('ophEditStatus').value,
  };
  // Campeonato/Times/Data/Horário — só entra no PATCH se for organizador (dupla
  // trava: mesmo que o campo estivesse habilitado por algum motivo, membro nunca
  // manda esses campos pro banco)
  if(souOrganizador){
    const casa = document.getElementById('ophEditCasa').value.trim();
    const vis = document.getElementById('ophEditVis').value.trim();
    const data = document.getElementById('ophEditData').value;
    if(!casa || !vis){ toast?.('Preencha Mandante e Visitante', true); return; }
    if(!data){ toast?.('Preencha a data do jogo', true); return; }
    campos.camp = document.getElementById('ophEditCamp').value.trim();
    campos.casa = casa;
    campos.vis = vis;
    campos.data = data;
    campos.horario = document.getElementById('ophEditHorario').value;
  }

  try {
    const res = await fetch(sbUrlAgendados('?id=eq.'+ophEditandoId), {
      method:'PATCH',
      headers: { ...sbHeaders(), 'Prefer':'return=representation' },
      body: JSON.stringify(campos)
    });
    if(!res.ok) throw new Error(await res.text());
    const atualizado = (await res.json())[0];
    Object.assign(j, atualizado);
    ophFecharEdicao();
    ophRenderLista();
    renderGeral();
    toast?.('Oportunidade atualizada!');
  } catch(e){
    toast?.('Erro ao salvar: ' + e.message, true);
  }
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
  let lista = ophCache.filter(j=>!ophExpirado(j)); // some sozinho 4h depois do horário (só da TELA — quem apaga de verdade é o organizador)
  lista = lista.slice().sort((a,b)=>((a.data||'')+(a.horario||'99:99')).localeCompare((b.data||'')+(b.horario||'99:99')));

  const souOrganizador = perfilAtual && perfilAtual.papel === 'organizador';

  // Limpa seleção de jogos que não existem mais (removidos ou expirados)
  const idsAtuais = new Set(lista.map(j=>j.id));
  [...ophSelecionados].forEach(id=>{ if(!idsAtuais.has(id)) ophSelecionados.delete(id); });

  const hoje = window.hojeBR ? window.hojeBR() : null;
  const html = lista.map(j=>{
    const sel = ophSelecionados.has(j.id);
    const foraDeHoje = j.data && hoje && j.data!==hoje;
    const dataFmt = foraDeHoje ? (window.fd ? window.fd(j.data) : j.data) : null;
    const temDados = j.mercado || j.odd || j.minuto;
    return `
    <div onclick="ophToggleSelecao(${j.id})" style="flex:0 0 auto;width:150px;background:var(--c2);border:2px solid ${sel?'var(--verde2)':'var(--c3)'};border-radius:10px;padding:24px 10px 10px;text-align:center;position:relative;cursor:pointer">
      ${sel?'<div style="position:absolute;top:6px;left:6px;width:16px;height:16px;border-radius:50%;background:var(--verde2);color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1">✓</div>':''}
      ${foraDeHoje?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:var(--c2-dest);color:var(--ouro);font-size:8px;font-weight:700;padding:2px 6px;border-radius:8px;white-space:nowrap">${dataFmt}</div>`:''}
      <button onclick="event.stopPropagation();ophAbrirEdicao(${j.id})" title="Editar" style="position:absolute;top:4px;right:22px;background:none;border:none;color:var(--texto2);font-size:13px;cursor:${sel?'pointer':'default'};padding:2px 4px;display:${sel?'flex':'none'}"><span data-ic="pencil" data-ic-size="13"></span></button>
      ${souOrganizador?`<button onclick="event.stopPropagation();ophRemover(${j.id})" style="position:absolute;top:4px;right:4px;background:none;border:none;color:var(--texto2);font-size:13px;cursor:${sel?'pointer':'default'};padding:2px 4px;display:${sel?'flex':'none'}">✕</button>`:''}
      <div style="width:30px;height:30px;margin:0 auto">${escudoImgOuIcone(j.casa)}</div>
      <div style="font-size:10.5px;font-weight:700;line-height:1.2;margin-top:2px">${j.casa||'—'}</div>
      <div style="height:8px"></div>
      <div style="width:30px;height:30px;margin:0 auto">${escudoImgOuIcone(j.vis)}</div>
      <div style="font-size:10.5px;font-weight:700;line-height:1.2;margin-top:2px">${j.vis||'—'}</div>
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--c3);font-size:9px;color:var(--ouro);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:center;gap:3px"><span data-ic="trophy" data-ic-size="10"></span> ${j.camp||'—'}</div>
      <div style="font-size:9px;color:var(--texto2);margin-top:2px">${[j.horario?(j.horario):null, j.rodada||null].filter(Boolean).join(' • ')||'—'}</div>
      ${temDados
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--c3);font-size:9px;color:var(--texto)">${[j.mercado||null, j.minuto?(j.minuto+"'"):null, j.odd?('@'+parseFloat(j.odd).toFixed(2)):null].filter(Boolean).join(' · ')||'—'}</div>`
        : ''}
    </div>`;
  }).join('');

  const vazio = `<div style="color:var(--texto2);font-size:12px;padding:10px">Nenhum jogo adicionado ainda.</div>`;
  ['ophListaDash'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) { el.innerHTML = html || vazio; window.renderIcons?.(el); }
  });
  ['ophListaTituloDash'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    // "Jogos Agendados" porque a lista já pode ter jogos de dias futuros, não só hoje
    el.innerHTML = `<span data-ic="clipboard" data-ic-size="14"></span> Jogos Agendados (${lista.length})`;
    window.renderIcons?.(el);
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
  const lista = ophCache.filter(j=>!ophExpirado(j) && ophSelecionados.has(j.id)).sort((a,b)=>(a.horario||'99:99').localeCompare(b.horario||'99:99'));
  if(!lista.length){ toast('Toque nos jogos que quer compartilhar primeiro'); return; }

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
  ].filter(l=>l!==null).join('\n'));

  const titulo = lista.length===1 ? `${lista[0].casa} × ${lista[0].vis}` : 'Jogos de Hoje';
  const txt = [
    ...blocos,
  ].join('\n\n━━━━━━━━━━━━━━━━━━\n\n') + `\n\n━━━━━━━━━━━━━━━━━━\n\n📅 Publicado em:\n${dataFmt} às ${horaFmt}\n\n📲 Ei Placar`;

  abrirCompartilhamento(txt.trim(), titulo);
  ophSelecionados.clear(); // já foram enviados — some a marcação pra não mandar de novo sem querer
  ophRenderLista();
}

// Carrega a lista compartilhada assim que o app abre, e atualiza sozinho de tempos
// em tempos — tanto pra sumir jogo vencido (4h após o horário) quanto pra puxar
// jogo novo/apagado por outra conta, sem precisar recarregar a página.
ophCarregarNuvem().then(ophRenderLista);
setInterval(async ()=>{ await ophCarregarNuvem(); ophRenderLista(); }, 60000);
