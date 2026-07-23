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
  fetch(cfgAppUrl('?id=eq.1'), {
    method:'PATCH', headers: sbHeaders(),
    body: JSON.stringify({ dados:d, updated_at:new Date().toISOString() })
  }).then(async res=>{
    if(res.ok) return;
    // linha ainda não existe (id=1) — cria
    await fetch(cfgAppUrl(''), { method:'POST', headers:{...sbHeaders(),'Prefer':'resolution=merge-duplicates'}, body: JSON.stringify({ id:1, dados:d }) });
  }).catch(()=>{}); // sem tabela/internet: fica só no cache local mesmo
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
  const d = new Date((dataBase||new Date().toISOString().split('T')[0])+'T00:00:00');
  d.setDate(d.getDate()+dias);
  return d.toISOString().split('T')[0];
}
// Ativa/troca o plano de um usuário (o organizador confirma manualmente que recebeu o
// pagamento — não existe gateway de pagamento integrado ainda).
async function adminAprovarPlano(id, planoId, dias){
  const hoje = new Date().toISOString().split('T')[0];
  return adminAtualizarUsuario(id, { plano:planoId, assinatura_status:'ativo', assinatura_inicio:hoje, assinatura_vencimento: somarDias(hoje, dias) });
}
// Renova a partir do vencimento atual (se ainda não venceu) ou de hoje (se já venceu)
async function adminRenovarPlano(id, vencimentoAtual, dias){
  const base = (vencimentoAtual && vencimentoAtual >= new Date().toISOString().split('T')[0]) ? vencimentoAtual : new Date().toISOString().split('T')[0];
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
