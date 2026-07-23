// ═══════════════════════════════════════════════════
// ESCUDOS DOS TIMES — upload, sincronização com a nuvem, exibição
// ═══════════════════════════════════════════════════
// ══ ESCUDOS DOS TIMES — sincronizados via Supabase (tabela "escudos"), com cache local de emergência ══
// Antes ficava só no localStorage do navegador: como cada arquivo .html baixado de novo conta como
// uma "origem" diferente pro navegador, os escudos sumiam toda vez que o app era atualizado.
// Agora fica salvo na nuvem (mesma lógica da Banca), então sobrevive a atualizações do sistema.
let escudosCache = null;
function escudosUrl(filtros){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/escudos' + (filtros || '');
}
function getEscudos(){
  if(escudosCache) return escudosCache;
  try { return JSON.parse(localStorage.getItem('mp_escudos')||'{}'); } catch(e){ return {}; }
}
function getEscudo(nome){
  if(!nome) return null;
  return getEscudos()[nome.trim().toLowerCase()] || null;
}
function salvarEscudo(nome, dataUrl){
  if(!nome) return;
  const esc = { ...getEscudos() };
  esc[nome.trim().toLowerCase()] = dataUrl;
  escudosCache = esc;
  try { localStorage.setItem('mp_escudos', JSON.stringify(esc)); } catch(e){}
  escudosSyncNuvem();
}
// Mesma proteção contra corrida de sincronização usada na Banca: nunca deixa 2 envios em paralelo,
// e sempre manda o estado mais atual do cache (nunca um instantâneo antigo que possa "vencer" por
// último e apagar um escudo salvo depois).
let escudosSyncEmAndamento = false;
let escudosSyncPendente = false;
async function escudosSyncNuvem(){
  if (!temConfig()) return;
  if (escudosSyncEmAndamento) { escudosSyncPendente = true; return; }
  escudosSyncEmAndamento = true;
  const esc = escudosCache;
  try {
    const res = await fetch(escudosUrl('?id=eq.1'), {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id:1, dados:esc, updated_at:new Date().toISOString() })
    });
    if(!res.ok){
      const t = await res.text();
      if(t.includes('does not exist') || t.includes('PGRST205') || t.includes('schema cache')){
        toast('⚠️ Crie a tabela "escudos" no Supabase pra salvar escudos na nuvem (veja ⚙️ Configurar)', true);
      }
    }
  } catch(e){ /* sem internet — fica só local mesmo, sem travar a UI */ }
  escudosSyncEmAndamento = false;
  if (escudosSyncPendente) { escudosSyncPendente = false; escudosSyncNuvem(); }
}
async function escudosCarregarNuvem(){
  if (!temConfig()) { escudosCache = getEscudos(); return; }
  if (escudosSyncEmAndamento || escudosSyncPendente) return; // idem: não sobrescreve enquanto tem envio local pendente
  try {
    const res = await fetch(escudosUrl('?id=eq.1&select=dados'), { headers: sbHeaders() });
    if(!res.ok) throw new Error();
    const data = await res.json();
    if(data && data[0] && data[0].dados){
      escudosCache = data[0].dados;
      localStorage.setItem('mp_escudos', JSON.stringify(escudosCache));
    } else if(!escudosCache){
      escudosCache = (()=>{ try{ return JSON.parse(localStorage.getItem('mp_escudos')) || {}; }catch{ return {}; } })();
    }
  } catch(e){
    if(!escudosCache){
      try { escudosCache = JSON.parse(localStorage.getItem('mp_escudos')) || {}; }
      catch { escudosCache = {}; }
    }
  }
}
function escudoImgOuIcone(nome){
  const url = getEscudo(nome);
  return url ? `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:contain;display:block">` : '🛡️';
}
function escudoMini(nome){
  const url = getEscudo(nome);
  return `<span class="escudo-mini" style="${url?'':'opacity:.35'}">${url ? `<img src="${url}" alt="">` : '🛡️'}</span>`;
}
let escudoCampoAtual = null;
function escudoInput(campoId){
  const nome = document.getElementById(campoId).value.trim();
  if(!nome){ toast('⚠️ Preencha o nome do time antes de adicionar o escudo'); return; }
  escudoCampoAtual = campoId;
  document.getElementById('escudoFileInput').click();
}
function onEscudoFileChange(ev){
  const file = ev.target.files[0];
  if(!file || !escudoCampoAtual) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      // Reduz pra no máximo 160x160 antes de salvar — mantém o escudo nítido o suficiente
      // pros tamanhos usados no app e evita ficar pesado pra sincronizar na nuvem.
      const max = 160;
      const escala = Math.min(1, max/Math.max(img.width, img.height));
      const w = Math.round(img.width*escala), h = Math.round(img.height*escala);
      const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = cv.toDataURL('image/png');
      const nome = document.getElementById(escudoCampoAtual).value.trim();
      salvarEscudo(nome, dataUrl);
      // Atualiza os círculos de escudo visíveis nos dois formulários (H2H e Editar Jogo)
      if(document.getElementById('iCasa')) syncNomes();
      if(document.getElementById('eCasa')) syncNomesEdicao();
      toast('🛡️ Escudo salvo — já vai aparecer em todo lugar desse time');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  ev.target.value = '';
}
function syncNomesEdicao(){
  const c=document.getElementById('eCasa').value.trim();
  const v=document.getElementById('eVis').value.trim();
  const ec=document.getElementById('eEscudoCasa'), ev=document.getElementById('eEscudoVis');
  if(ec) ec.innerHTML=escudoImgOuIcone(c);
  if(ev) ev.innerHTML=escudoImgOuIcone(v);
}

// ══ SYNC NOMES ══
function syncNomes() {
  const c=document.getElementById('iCasa').value.trim()||'Mandante';
  const v=document.getElementById('iVis').value.trim()||'Visitante';
  const htmlC=escudoImgOuIcone(c), htmlV=escudoImgOuIcone(v);
  const pc=document.getElementById('pNomeCasa'); if(pc) pc.textContent=c;
  const pv=document.getElementById('pNomeVis');  if(pv) pv.textContent=v;
  const ec=document.getElementById('escudoCasa'); if(ec) ec.innerHTML=htmlC;
  const ev=document.getElementById('escudoVis');  if(ev) ev.innerHTML=htmlV;
  // Mini-escudos repetidos em cada seção de estatística (Ranking, Chutes, Escanteios...)
  document.querySelectorAll('.escudo-mini-casa').forEach(el=>el.innerHTML=htmlC);
  document.querySelectorAll('.escudo-mini-vis').forEach(el=>el.innerHTML=htmlV);
  const bc=document.getElementById('btnCasa'); if(bc) bc.textContent=c;
  const bv=document.getElementById('btnVis');  if(bv) bv.textContent=v;
  const lc=document.getElementById('legCasa'); if(lc) lc.textContent=c;
  const lv=document.getElementById('legVis');  if(lv) lv.textContent=v;
  renderCampo();
}

// ══ GOLS ══
function addGol(time) {
  const min=parseInt(document.getElementById('golMin').value);
  if(!min||min<1||min>120){ toast('⚠️ Informe o minuto (1–120)'); return; }
  const c=document.getElementById('iCasa').value.trim()||'Mandante';
  const v=document.getElementById('iVis').value.trim()||'Visitante';
  golsTemp.push({ min, time, nome:time==='casa'?c:v });
  golsTemp.sort((a,b)=>a.min-b.min);
  document.getElementById('golMin').value='';
  document.getElementById('golMin').focus();
  renderCampo(); renderGolsLista();
}
function removerGol(i){ golsTemp.splice(i,1); renderCampo(); renderGolsLista(); }

function renderCampo() {
  document.getElementById('campoVisual').innerHTML=periodos6.map(p=>{
    const gols=golsTemp.filter(g=>g.min>=p.s&&g.min<=p.e);
    return `<div class="campo-row"><div class="periodo-label">${p.l}</div><div class="periodo-gols">${gols.map(g=>{
      const i=golsTemp.indexOf(g);
      return `<span class="gol-chip ${g.time}" onclick="removerGol(${i})" title="Toque para remover"><span>${g.min}'</span> <span>${g.nome}</span> <span style="opacity:.6">✕</span></span>`;
    }).join('')}</div></div>`;
  }).join('');
}
function renderGolsLista(){
  document.getElementById('contGols').textContent=golsTemp.length+(golsTemp.length===1?' gol':' gols');
  document.getElementById('golsLista').innerHTML=golsTemp.map((g,i)=>`<div class="gol-item"><span class="gi-min">${g.min}'</span><span>⚽</span><span class="gi-time ${g.time}">${g.nome}</span><button class="gi-del" onclick="removerGol(${i})">✕</button></div>`).join('');
}

// ══ SALVAR ══
