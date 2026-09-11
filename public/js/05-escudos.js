// ═══════════════════════════════════════════════════
// ESCUDOS DOS TIMES — upload, sincronização com a nuvem, exibição
// ═══════════════════════════════════════════════════
// ══ ESCUDOS DOS TIMES — arquivos no Supabase Storage (bucket "escudos"), com
// só a URL (texto pequeno) sincronizada via tabela "escudos" + cache local. ══
// Antes cada escudo ficava como imagem inteira em base64 dentro da tabela, e o
// blob JSON com TODOS os escudos era baixado por completo toda vez que o app
// abria (e reenviado por completo a cada escudo novo/trocado) — isso consumia
// bandwidth do Supabase muito rápido. Agora só a URL do arquivo é sincronizada
// (poucos bytes por time) e a imagem em si é servida pelo Storage/CDN, com
// cache normal de navegador — só baixa de novo se o arquivo realmente mudar.
let escudosCache = null;
const ESCUDOS_BUCKET = 'escudos';
function escudosUrl(filtros){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/escudos' + (filtros || '');
}
// Nome do time → nome de arquivo seguro (sem acento/espaço/símbolo), pra usar como
// path no bucket. Ex: "América-MG" → "america-mg".
function escudoSlug(nome){
  return (nome || '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'time';
}
function escudoStorageUploadUrl(path){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/storage/v1/object/' + ESCUDOS_BUCKET + '/' + path;
}
function escudoStoragePublicUrl(path){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/storage/v1/object/public/' + ESCUDOS_BUCKET + '/' + path;
}
function getEscudos(){
  if(escudosCache) return escudosCache;
  try { return JSON.parse(localStorage.getItem('mp_escudos')||'{}'); } catch(e){ return {}; }
}
function getEscudo(nome){
  if(!nome) return null;
  const url = getEscudos()[nome.trim().toLowerCase()] || null;
  return escudoUrlValida(url) ? url : null;
}
// Auditoria de segurança, achado SEC-002 (defesa em profundidade): mesmo com a
// escrita na tabela "escudos" agora restrita a organizador (RLS), essa função
// garante que só um data URI de imagem de verdade OU uma URL do nosso próprio
// bucket público de escudos vira <img src="...">. Sem essa trava, um valor
// malicioso salvo ali (ex: `x" onerror="...`) quebraria pra fora do atributo
// HTML na hora de montar escudoImgOuIcone/escudoMini e executaria script no
// navegador de quem visse aquele escudo (stored XSS).
function escudoUrlValida(url){
  if(typeof url !== 'string') return false;
  if(/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url)) return true; // legado, ainda não migrado
  const prefixoStorage = getConfig().url.replace(/\/$/, '') + '/storage/v1/object/public/' + ESCUDOS_BUCKET + '/';
  return url.startsWith(prefixoStorage);
}
function salvarEscudo(nome, url){
  if(!nome) return;
  const esc = { ...getEscudos() };
  esc[nome.trim().toLowerCase()] = url;
  escudosCache = esc;
  try { localStorage.setItem('mp_escudos', JSON.stringify(esc)); } catch(e){}
  escudosSyncNuvem();
}
// Some navegadores/redes deixam uma requisição "pendurada" sem nunca resolver nem
// rejeitar (nem sucesso, nem erro) — sem isso, um único item travado emperra a
// migração inteira pra sempre em "0/342". Com o timeout, esse item vira erro e
// o loop segue pros próximos.
function fetchComTimeout(url, opts, timeoutMs){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 15000);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}
// Sobe o arquivo (Blob/PNG) pro bucket "escudos" do Storage e devolve a URL pública.
// 'upsert:true' permite trocar o escudo de um time sem precisar apagar o arquivo antigo antes.
//
// IMPORTANTE sobre a chave: o projeto usa a chave nova do Supabase ("sb_publishable_...",
// não é um JWT). O serviço de Storage rejeita (400) se essa chave publishable também for
// mandada no cabeçalho Authorization — ele tenta decodificar como JWT e falha. Por isso,
// só mandamos Authorization quando existe de verdade um token de sessão (JWT do usuário
// logado); sem sessão, vai só o apikey.
async function uploadEscudoStorage(nome, blob){
  const path = escudoSlug(nome) + '.png';
  const cfg = getConfig();
  const sessao = authGetSessao();
  const headers = { 'apikey': cfg.key, 'Content-Type': 'image/png', 'x-upsert': 'true' };
  if(sessao && sessao.access_token) headers['Authorization'] = 'Bearer ' + sessao.access_token;
  const res = await fetchComTimeout(escudoStorageUploadUrl(path), {
    method: 'POST',
    headers,
    body: blob,
  });
  if(!res.ok){
    const t = await res.text();
    if(t.includes('not found') || t.includes('Bucket not found')){
      throw new Error('Crie o bucket público "escudos" no Supabase Storage antes de subir escudos (veja Configurar).');
    }
    if(t.includes('row-level security') || t.includes('Unauthorized') || t.includes('policy')){
      throw new Error('Sem permissão pra subir no bucket "escudos" — confira a política de RLS de INSERT/UPDATE pro role authenticated, e se sua sessão de login ainda está válida.');
    }
    throw new Error('Falha ao subir o escudo (' + res.status + '): ' + t);
  }
  return escudoStoragePublicUrl(path);
}
// Migração única: converte os escudos que ainda estão em base64 (formato antigo)
// pra arquivos no Storage, e atualiza a referência pra URL (bem mais leve).
// Chamada pelo botão "Migrar Escudos" em Administração → Sistema.
async function migrarEscudosParaStorage(onProgresso){
  await escudosCarregarNuvem();
  const esc = { ...getEscudos() };
  const nomes = Object.keys(esc).filter(n => typeof esc[n] === 'string' && esc[n].startsWith('data:image'));
  let migrados = 0, erros = 0;
  for(const nome of nomes){
    try {
      const blob = await (await fetchComTimeout(esc[nome], {}, 15000)).blob(); // converte o data URI já em memória, sem baixar nada externo
      const urlPublica = await uploadEscudoStorage(nome, blob);
      esc[nome] = urlPublica;
      migrados++;
    } catch(e){
      erros++;
      console.warn('[migrarEscudosParaStorage] falhou em "' + nome + '":', e && e.message ? e.message : e);
    }
    onProgresso?.({ total: nomes.length, migrados, erros });
  }
  escudosCache = esc;
  try { localStorage.setItem('mp_escudos', JSON.stringify(esc)); } catch(e){}
  await escudosSyncNuvem(); // reenvia o objeto (agora só com URLs, bem menor) uma última vez
  return { total: nomes.length, migrados, erros };
}
window.migrarEscudosParaStorage = migrarEscudosParaStorage;
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
    const res = await fetchComTimeout(escudosUrl('?id=eq.1'), {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id:1, dados:esc, updated_at:new Date().toISOString() })
    }, 15000);
    if(!res.ok){
      const t = await res.text();
      if(t.includes('does not exist') || t.includes('PGRST205') || t.includes('schema cache')){
        toast('Crie a tabela "escudos" no Supabase pra salvar escudos na nuvem (veja Configurar)', true);
      }
    }
  } catch(e){ /* sem internet (ou travou/deu timeout) — fica só local mesmo, sem travar a UI */ }
  escudosSyncEmAndamento = false;
  if (escudosSyncPendente) { escudosSyncPendente = false; escudosSyncNuvem(); }
}
async function escudosCarregarNuvem(){
  if (!temConfig()) { escudosCache = getEscudos(); return; }
  if (escudosSyncEmAndamento || escudosSyncPendente) return; // idem: não sobrescreve enquanto tem envio local pendente
  try {
    const res = await fetchComTimeout(escudosUrl('?id=eq.1&select=dados'), { headers: sbHeaders() }, 15000);
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
  return url ? `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:contain;display:block">` : ic('shield', 20, 'width:100%;height:100%');
}
function escudoMini(nome){
  const url = getEscudo(nome);
  return `<span class="escudo-mini" style="${url?'':'opacity:.35'}">${url ? `<img src="${url}" alt="">` : ic('shield', 14)}</span>`;
}
let escudoCampoAtual = null;
function escudoInput(campoId){
  const nome = document.getElementById(campoId).value.trim();
  if(!nome){ toast('Preencha o nome do time antes de adicionar o escudo'); return; }
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
      // pros tamanhos usados no app e evita ficar pesado pra subir/exibir.
      const max = 160;
      const escala = Math.min(1, max/Math.max(img.width, img.height));
      const w = Math.round(img.width*escala), h = Math.round(img.height*escala);
      const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const nome = document.getElementById(escudoCampoAtual).value.trim();
      const aplicarEAvisar = (url) => {
        salvarEscudo(nome, url);
        if(document.getElementById('iCasa')) syncNomes();
        if(document.getElementById('eCasa')) syncNomesEdicao();
      };
      cv.toBlob(async (blob) => {
        try {
          const urlPublica = await uploadEscudoStorage(nome, blob);
          aplicarEAvisar(urlPublica);
          toast('Escudo salvo — já vai aparecer em todo lugar desse time');
        } catch(e){
          // Sem bucket configurado ou sem internet: cai pro formato antigo (base64),
          // pra não travar o cadastro — dá pra migrar depois pelo Storage quando resolver.
          const dataUrl = cv.toDataURL('image/png');
          aplicarEAvisar(dataUrl);
          toast(e.message || 'Escudo salvo localmente (sem Storage configurado ainda)', true);
        }
      }, 'image/png');
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
  const c=document.getElementById('iCasa').value.trim()||'Casa';
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
// "min" é sempre o minuto-BASE (1-45 no 1º tempo, 46-90 no 2º) — nunca a soma com o
// acréscimo. É esse campo que classifica o gol em "1º tempo" ou "2º tempo" em TODO o
// motor de análise (HT, faixas de minuto etc.), então ele precisa continuar <=45 pra
// gol nos acréscimos do 1º tempo (ex: 45+3) continuar contando como 1º tempo — daí
// "acr" (acréscimo) ser um campo separado, só usado pra mostrar "45+3'", nunca somado
// no "min". Sem isso, um gol aos 45+3 viraria min=48 e passaria a contar (errado) como
// gol do 2º tempo em tudo — desde o gráfico de faixas até as estatísticas de HT.
//
// Genérico: usado tanto no formulário de "Adicionar Partida" quanto no de "Editar Jogo"
// (antes só dava pra corrigir um gol errado apagando o jogo inteiro e cadastrando de
// novo) — cada formulário passa seu próprio array de gols temporários e IDs de elemento.
function rotuloMin(g){ return g.acr ? `${g.min}+${g.acr}` : `${g.min}`; }

function _addGolGenerico(temp, ids, time){
  const min=parseInt(document.getElementById(ids.min).value);
  const acr=parseInt(document.getElementById(ids.acr).value)||0;
  if(!min||min<1||min>90){ toast('Informe o minuto (1–90, sem somar o acréscimo)'); return; }
  const c=document.getElementById(ids.casa).value.trim()||'Casa';
  const v=document.getElementById(ids.vis).value.trim()||'Visitante';
  temp.push({ min, acr, time, nome:time==='casa'?c:v });
  temp.sort((a,b)=>(a.min+a.acr)-(b.min+b.acr));
  document.getElementById(ids.min).value='';
  document.getElementById(ids.acr).value='';
  document.getElementById(ids.min).focus();
  _renderCampoGenerico(temp, ids);
  _renderGolsListaGenerico(temp, ids);
}
function _renderCampoGenerico(temp, ids){
  document.getElementById(ids.campo).innerHTML=periodos6.map(p=>{
    const gols=temp.filter(g=>g.min>=p.s&&g.min<=p.e);
    return `<div class="campo-row"><div class="periodo-label">${p.l}</div><div class="periodo-gols">${gols.map(g=>{
      const i=temp.indexOf(g);
      return `<span class="gol-chip ${g.time}" onclick="${ids.removerFn}(${i})" title="Toque para remover"><span>${rotuloMin(g)}'</span> <span>${g.nome}</span> <span style="opacity:.6">✕</span></span>`;
    }).join('')}</div></div>`;
  }).join('');
}
function _renderGolsListaGenerico(temp, ids){
  const contEl = document.getElementById(ids.cont);
  if(contEl) contEl.textContent=temp.length+(temp.length===1?' gol':' gols');
  document.getElementById(ids.lista).innerHTML=temp.map((g,i)=>`<div class="gol-item"><span class="gi-min">${rotuloMin(g)}'</span><span data-ic="target" data-ic-size="13"></span><span class="gi-time ${g.time}">${g.nome}</span><button class="gi-del" onclick="${ids.removerFn}(${i})">✕</button></div>`).join('');
  window.renderIcons?.(document.getElementById(ids.lista));
}

// ── Formulário "Adicionar Partida" (Partidas → Novo Jogo) ──
const IDS_GOL_ADD = { min:'golMin', acr:'golAcr', casa:'iCasa', vis:'iVis', campo:'campoVisual', lista:'golsLista', cont:'contGols', removerFn:'removerGol' };
function addGol(time){ _addGolGenerico(golsTemp, IDS_GOL_ADD, time); }
function removerGol(i){ golsTemp.splice(i,1); _renderCampoGenerico(golsTemp, IDS_GOL_ADD); _renderGolsListaGenerico(golsTemp, IDS_GOL_ADD); }
function renderCampo(){ _renderCampoGenerico(golsTemp, IDS_GOL_ADD); }
function renderGolsLista(){ _renderGolsListaGenerico(golsTemp, IDS_GOL_ADD); }

// ── Formulário "Editar Jogo" (Dados → toque no jogo → Editar) — mesma lógica, IDs "e" ──
let golsTempEdit = [];
const IDS_GOL_EDIT = { min:'eGolMin', acr:'eGolAcr', casa:'eCasa', vis:'eVis', campo:'eCampoVisual', lista:'eGolsLista', cont:'eContGols', removerFn:'removerGolEdit' };
function addGolEdit(time){ _addGolGenerico(golsTempEdit, IDS_GOL_EDIT, time); }
function removerGolEdit(i){ golsTempEdit.splice(i,1); _renderCampoGenerico(golsTempEdit, IDS_GOL_EDIT); _renderGolsListaGenerico(golsTempEdit, IDS_GOL_EDIT); }
function renderCampoEdit(){ _renderCampoGenerico(golsTempEdit, IDS_GOL_EDIT); }
function renderGolsListaEdit(){ _renderGolsListaGenerico(golsTempEdit, IDS_GOL_EDIT); }

// ══ SALVAR ══
