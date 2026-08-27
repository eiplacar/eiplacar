// ═══════════════════════════════════════════════════
// ADMINISTRAÇÃO — usuários, assinaturas, config do sistema (só organizador)
// ═══════════════════════════════════════════════════

// ══ CONFIG DO APP (preço dos planos, dias de teste) — tabela "config_app" ══
const CFG_APP_KEY = 'eiPlacar_configApp';
const CFG_APP_VAZIO = { precoMensal:9.90, precoTrimestral:24.99, precoSemestral:19.99, diasTeste:60 };
let cfgAppCache = null;

function cfgAppUrl(filtros){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/config_app' + (filtros || '');
}
function cfgAppLoad(){
  if(cfgAppCache) return cfgAppCache;
  try { return { ...CFG_APP_VAZIO, ...(JSON.parse(localStorage.getItem(CFG_APP_KEY))||{}) }; }
  catch { return { ...CFG_APP_VAZIO }; }
}
function cfgAppSave(d){
  cfgAppCache = d;
  localStorage.setItem(CFG_APP_KEY, JSON.stringify(d));
  return fetch(cfgAppUrl('?id=eq.1'), {
    method:'PATCH', headers: sbHeaders(),
    body: JSON.stringify({ dados:d, updated_at:new Date().toISOString() })
  }).then(async res=>{
    if(!res.ok) throw new Error('patch falhou');
    // Com Prefer: return=representation, se nenhuma linha bateu o filtro (id=1 ainda
    // não existe) a resposta vem OK só que com um array vazio — precisa criar a linha.
    const linhas = await res.json().catch(()=>[]);
    if(Array.isArray(linhas) && linhas.length===0) throw new Error('nenhuma linha existente');
    return true;
  }).catch(async ()=>{
    // linha ainda não existe (id=1) ou PATCH falhou — tenta criar
    const res2 = await fetch(cfgAppUrl(''), { method:'POST', headers:{...sbHeaders(),'Prefer':'resolution=merge-duplicates,return=representation'}, body: JSON.stringify({ id:1, dados:d }) });
    if(!res2.ok) throw new Error('não foi possível salvar no Supabase');
    return true;
  });
}
async function cfgAppCarregarNuvem(){
  if(!temConfig()){ cfgAppCache = cfgAppLoad(); return; }
  try {
    const res = await fetch(cfgAppUrl('?id=eq.1&select=dados'), { headers: sbHeaders() });
    if(!res.ok) throw new Error();
    const data = await res.json();
    cfgAppCache = { ...CFG_APP_VAZIO, ...((data&&data[0]&&data[0].dados)||{}) };
    localStorage.setItem(CFG_APP_KEY, JSON.stringify(cfgAppCache));
  } catch { if(!cfgAppCache) cfgAppCache = cfgAppLoad(); }
}
window.cfgAppLoad = cfgAppLoad;
window.cfgAppSave = cfgAppSave;
window.cfgAppCarregarNuvem = cfgAppCarregarNuvem;

// ══ TELA "SEJA ASSINANTE" ══
// Mostra os 3 planos com preço vindo de config_app (editável em Administração →
// Sistema). O clique em "Assinar" ainda é um placeholder — vira chamada de
// verdade pra Netlify function assim que o Mercado Pago estiver configurado
// (MP_ACCESS_TOKEN). Não precisa mexer aqui de novo quando isso acontecer,
// só trocar o corpo de iniciarAssinatura().
function renderAssinar(){
  const el = document.getElementById('assinarPlanos');
  if(!el) return;
  const cfg = cfgAppLoad();
  const venceu = window.assinaturaVencida?.();
  const sub = document.getElementById('assinarSubtitulo');
  if(sub) sub.textContent = venceu
    ? 'Seu período de teste grátis acabou. Assine um plano para continuar.'
    : 'Continue com acesso liberado a tudo do EI PLACAR.';

  const planos = [
    { id:'mensal',      nome:'Mensal',      preco:cfg.precoMensal,      obs:'cobrado todo mês' },
    { id:'trimestral',  nome:'Trimestral',  preco:cfg.precoTrimestral,  obs:'cobrado a cada 3 meses' },
    { id:'semestral',   nome:'Semestral',   preco:cfg.precoSemestral,   obs:'cobrado a cada 6 meses' },
  ];
  el.innerHTML = planos.map(p=>`
    <div style="background:var(--c2);border:2px solid var(--c3);border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div>
        <div style="font-size:14px;font-weight:800">${p.nome}</div>
        <div style="font-size:10.5px;color:var(--texto2)">${p.obs}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:900;color:var(--ouro)">R$ ${Number(p.preco||0).toFixed(2).replace('.',',')}</div>
        <button onclick="iniciarAssinatura('${p.id}')" style="margin-top:4px;background:var(--verde2);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer">Assinar</button>
      </div>
    </div>`).join('');
}
window.renderAssinar = renderAssinar;

async function iniciarAssinatura(planoId){
  // Placeholder — a integração real (Netlify function → Mercado Pago) entra
  // assim que o MP_ACCESS_TOKEN de produção estiver configurado.
  toast('Pagamento chegando em breve! Estamos finalizando a integração com o Mercado Pago.');
}
window.iniciarAssinatura = iniciarAssinatura;

// ══ USUÁRIOS (Administração → Usuários / Assinaturas) ══
// Lê a lista inteira de perfis (a mesma política de RLS que já libera o organizador
// enxergar todo mundo em "Cadastros Pendentes" libera esse select mais completo também).
const CAMPOS_ADMIN_USUARIO = 'id,nome,email,telefone,data_nascimento,papel,status,bloqueado,created_at,plano,assinatura_status,assinatura_inicio,assinatura_vencimento';
async function adminListarUsuarios(){
  try {
    const res = await fetch(sbUrlPerfis('?select='+CAMPOS_ADMIN_USUARIO+'&order=nome.asc'), { headers: sbHeaders() });
    if(res.ok) return { ok:true, usuarios: await res.json() };
    // colunas extras podem não existir ainda — cai pro select básico
    const res2 = await fetch(sbUrlPerfis('?select=id,nome,papel,status&order=nome.asc'), { headers: sbHeaders() });
    if(!res2.ok) return { ok:false, usuarios:[] };
    return { ok:true, colunasFaltando:true, usuarios: await res2.json() };
  } catch { return { ok:false, usuarios:[] }; }
}
async function adminAtualizarUsuario(id, campos){
  try {
    const res = await fetch(sbUrlPerfis('?id=eq.'+id), {
      method:'PATCH', headers: { ...sbHeaders(), 'Prefer':'return=representation' },
      body: JSON.stringify(campos)
    });
    if(!res.ok){ const t = await res.text(); return { ok:false, msg:t }; }
    return { ok:true };
  } catch(e){ return { ok:false, msg:e.message }; }
}
// Exclui só o PERFIL (revoga o acesso ao app). Não existe como apagar o login/senha da
// pessoa por aqui — isso exige a chave "service role" do Supabase, que nunca deve ficar
// exposta no navegador. Se ela tentar se cadastrar de novo com o mesmo e-mail, vai precisar
// ser aprovada de novo.
async function adminExcluirUsuario(id){
  try {
    const res = await fetch(sbUrlPerfis('?id=eq.'+id), { method:'DELETE', headers: sbHeaders() });
    if(!res.ok){ const t = await res.text(); return { ok:false, msg:t }; }
    return { ok:true };
  } catch(e){ return { ok:false, msg:e.message }; }
}

function somarDias(dataBase, dias){
  const d = new Date((dataBase||hojeBR())+'T00:00:00'); // corrigido pro fuso de Brasília (ver 04-utils.js)
  d.setDate(d.getDate()+dias);
  return d.toISOString().split('T')[0];
}
// Ativa/troca o plano de um usuário (o organizador confirma manualmente que recebeu o
// pagamento — não existe gateway de pagamento integrado ainda).
async function adminAprovarPlano(id, planoId, dias){
  const hoje = hojeBR(); // corrigido pro fuso de Brasília (ver 04-utils.js)
  return adminAtualizarUsuario(id, { plano:planoId, assinatura_status:'ativo', assinatura_inicio:hoje, assinatura_vencimento: somarDias(hoje, dias) });
}
// Renova a partir do vencimento atual (se ainda não venceu) ou de hoje (se já venceu)
async function adminRenovarPlano(id, vencimentoAtual, dias){
  const base = (vencimentoAtual && vencimentoAtual >= hojeBR()) ? vencimentoAtual : hojeBR(); // corrigido pro fuso de Brasília (ver 04-utils.js)
  return adminAtualizarUsuario(id, { assinatura_status:'ativo', assinatura_vencimento: somarDias(base, dias) });
}
async function adminCancelarAssinatura(id){
  return adminAtualizarUsuario(id, { assinatura_status:'cancelado' });
}
async function adminBloquearUsuario(id, bloquear){
  return adminAtualizarUsuario(id, { bloqueado: !!bloquear });
}

window.adminListarUsuarios = adminListarUsuarios;
window.adminAtualizarUsuario = adminAtualizarUsuario;
window.adminExcluirUsuario = adminExcluirUsuario;
window.adminAprovarPlano = adminAprovarPlano;
window.adminRenovarPlano = adminRenovarPlano;
window.adminCancelarAssinatura = adminCancelarAssinatura;
window.adminBloquearUsuario = adminBloquearUsuario;
