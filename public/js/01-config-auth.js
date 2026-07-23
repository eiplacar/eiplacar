// ═══════════════════════════════════════════════════
// CONFIG + AUTENTICAÇÃO — configuração do Supabase, login/cadastro, sessão, aprovação de membros
// ═══════════════════════════════════════════════════
// ══════════════════════════════════════════
//  SUPABASE CONFIG — fetch direto (sem SDK)
// ══════════════════════════════════════════
const CFG_KEY = 'eiPlacar_supabase_cfg';
let jogosCache = [];

const SUPA_URL = 'https://bwddsdggadlhusntbbrb.supabase.co';
const SUPA_KEY = 'sb_publishable_miuYWMkIhrsqAb63ihpJIQ_uz9ko3gx';

function getConfig() {
  return { url: SUPA_URL, key: SUPA_KEY };
}
function saveConfig(cfg) { /* credenciais fixas */ }

function temConfig() {
  const cfg = getConfig();
  return !!(cfg.url && cfg.key);
}

// Monta headers padrão para a API REST do Supabase
// Usa o token da pessoa logada quando existir (necessário para o RLS funcionar);
// cai para a chave anônima apenas em chamadas feitas antes do login.
function sbHeaders() {
  const cfg = getConfig();
  const sessao = authGetSessao();
  return {
    'Content-Type': 'application/json',
    'apikey': cfg.key,
    'Authorization': 'Bearer ' + (sessao && sessao.access_token ? sessao.access_token : cfg.key),
    'Prefer': 'return=representation'
  };
}

// ══════════════════════════════════════════
//  AUTENTICAÇÃO — Supabase Auth via fetch puro
// ══════════════════════════════════════════
const AUTH_KEY = 'eiPlacar_sessao';
let perfilAtual = null; // { id, nome, papel, status }

function authUrl(caminho){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/auth/v1' + caminho;
}
function authHeadersBase(){
  const cfg = getConfig();
  return { 'Content-Type': 'application/json', 'apikey': cfg.key };
}

function authGetSessao(){
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}
function authSaveSessao(s){ localStorage.setItem(AUTH_KEY, JSON.stringify(s)); }
function authClearSessao(){ localStorage.removeItem(AUTH_KEY); }

function authMostrarMsg(texto, tipo){
  const el = document.getElementById('authMsg');
  el.textContent = texto;
  el.className = 'auth-msg show ' + (tipo||'info');
}
function authLimparMsg(){
  const el = document.getElementById('authMsg');
  el.className = 'auth-msg';
}

function authGoTab(t){
  document.querySelectorAll('.auth-tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(x=>x.classList.remove('active'));
  const tabEl = document.getElementById('atab-'+t);
  if(tabEl) tabEl.classList.add('active');
  document.getElementById('aform-'+t).classList.add('active');
  // Esconde as abas Entrar/Criar Conta quando estiver em recuperação de senha
  const tabsWrap = document.querySelector('.auth-tabs');
  if(tabsWrap) tabsWrap.style.display = (t==='recuperar'||t==='novasenha') ? 'none' : '';
  authLimparMsg();
}

// ── CADASTRO ──
async function fazerCadastro(){
  const nome  = document.getElementById('cadNome').value.trim();
  const email = document.getElementById('cadEmail').value.trim();
  const senha = document.getElementById('cadSenha').value;
  authLimparMsg();
  if(!nome)  { authMostrarMsg('⚠️ Informe seu nome', 'erro'); return; }
  if(!email) { authMostrarMsg('⚠️ Informe seu e-mail', 'erro'); return; }
  if(!senha||senha.length<6){ authMostrarMsg('⚠️ A senha precisa ter no mínimo 6 caracteres', 'erro'); return; }

  try {
    const res = await fetch(authUrl('/signup'), {
      method:'POST', headers: authHeadersBase(),
      body: JSON.stringify({ email, password: senha, data: { nome } })
    });
    const data = await res.json();
    if(!res.ok){
      const msg = (data && data.msg) || (data && data.error_description) || 'Erro ao criar conta';
      if(msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')){
        authMostrarMsg('⚠️ Este e-mail já possui conta. Tente entrar.', 'erro');
      } else {
        authMostrarMsg('⚠️ ' + msg, 'erro');
      }
      return;
    }
    if(data.access_token){
      authSaveSessao(data);
      await authIniciarSessao();
      // Início do teste grátis — tentativa silenciosa; se as colunas de assinatura ainda não
      // existirem nessa base, não faz diferença nenhuma pro login (só não mostra prazo na aba Conta).
      const dias = (cfgAppLoad().diasTeste) || 60;
      const hoje = new Date().toISOString().split('T')[0];
      salvarPerfil({ assinatura_status:'trial', assinatura_inicio:hoje, assinatura_vencimento: (()=>{ const d=new Date(); d.setDate(d.getDate()+dias); return d.toISOString().split('T')[0]; })() }).catch(()=>{});
    } else if(data.user && Array.isArray(data.user.identities) && data.user.identities.length===0){
      // O Supabase, por segurança, não revela se o e-mail já existe: quando a confirmação por
      // e-mail está ativada, um cadastro repetido volta como "sucesso" mas com identities:[] —
      // esse é o sinal de que já existe conta com esse e-mail.
      authMostrarMsg('⚠️ Este e-mail já possui conta. Tente entrar ou recupere sua senha.', 'erro');
    } else {
      // projeto com confirmação por e-mail ativada
      authMostrarMsg('✅ Conta criada! Verifique seu e-mail para confirmar, depois faça login.', 'ok');
      authGoTab('login');
    }
  } catch(e){
    authMostrarMsg('❌ Erro de conexão: ' + e.message, 'erro');
  }
}

// ── LOGIN ──
async function fazerLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  authLimparMsg();
  if(!email||!senha){ authMostrarMsg('⚠️ Informe e-mail e senha', 'erro'); return; }

  try {
    const res = await fetch(authUrl('/token?grant_type=password'), {
      method:'POST', headers: authHeadersBase(),
      body: JSON.stringify({ email, password: senha })
    });
    const data = await res.json();
    if(!res.ok){
      const msg = (data && data.error_description) || (data && data.msg) || 'E-mail ou senha incorretos';
      authMostrarMsg('⚠️ ' + msg, 'erro');
      return;
    }
    authSaveSessao(data);
    await authIniciarSessao();
  } catch(e){
    authMostrarMsg('❌ Erro de conexão: ' + e.message, 'erro');
  }
}

async function fazerLogout(){
  try {
    const sessao = authGetSessao();
    if(sessao?.access_token){
      await fetch(authUrl('/logout'), {
        method: 'POST',
        headers: { ...authHeadersBase(), 'Authorization': 'Bearer ' + sessao.access_token }
      });
    }
  } catch(e){ /* ignora erro de rede */ }
  authClearSessao();
  perfilAtual = null;
  jogosCache = [];
  // Limpa campos de login
  const el = document.getElementById('loginEmail'); if(el) el.value='';
  const es = document.getElementById('loginSenha'); if(es) es.value='';
  authAplicarTela();
}

// ── Mostrar/ocultar senha (ícone de olho) ──
function togglePwd(id, btn){
  const el = document.getElementById(id);
  if(el.type==='password'){ el.type='text'; btn.textContent='🙈'; }
  else { el.type='password'; btn.textContent='👁️'; }
}

// ── Recuperar senha: envia e-mail com link via Supabase Auth ──
async function enviarRecuperacaoSenha(){
  const email = document.getElementById('recEmail').value.trim();
  authLimparMsg();
  if(!email){ authMostrarMsg('⚠️ Informe seu e-mail', 'erro'); return; }
  try {
    const res = await fetch(authUrl('/recover'), {
      method:'POST', headers: authHeadersBase(),
      body: JSON.stringify({ email, redirect_to: location.origin + location.pathname })
    });
    // O Supabase responde 200 mesmo se o e-mail não existir (por segurança, não revela quais e-mails têm conta)
    if(res.ok){
      authMostrarMsg('✅ Se esse e-mail tiver conta, enviamos um link de recuperação. Verifique sua caixa de entrada (e o spam).', 'ok');
    } else {
      const data = await res.json().catch(()=>({}));
      authMostrarMsg('⚠️ ' + ((data&&data.msg)||(data&&data.error_description)||'Erro ao enviar e-mail'), 'erro');
    }
  } catch(e){
    authMostrarMsg('❌ Erro de conexão: ' + e.message, 'erro');
  }
}

// ── Define a nova senha, usando o token que veio no link do e-mail (na URL) ──
let tokenRecuperacao = null;
async function salvarNovaSenha(){
  const senha = document.getElementById('novaSenha').value;
  authLimparMsg();
  if(!senha||senha.length<6){ authMostrarMsg('⚠️ A senha precisa ter no mínimo 6 caracteres', 'erro'); return; }
  if(!tokenRecuperacao){ authMostrarMsg('⚠️ Link inválido ou expirado. Solicite a recuperação novamente.', 'erro'); return; }
  try {
    const res = await fetch(authUrl('/user'), {
      method:'PUT',
      headers: { ...authHeadersBase(), 'Authorization': 'Bearer ' + tokenRecuperacao },
      body: JSON.stringify({ password: senha })
    });
    const data = await res.json();
    if(!res.ok){
      authMostrarMsg('⚠️ ' + ((data&&data.msg)||(data&&data.error_description)||'Erro ao salvar nova senha'), 'erro');
      return;
    }
    authMostrarMsg('✅ Senha alterada! Faça login com a nova senha.', 'ok');
    history.replaceState(null, '', location.pathname); // limpa o token da URL
    setTimeout(()=>authGoTab('login'), 1500);
  } catch(e){
    authMostrarMsg('❌ Erro de conexão: ' + e.message, 'erro');
  }
}

// Ao abrir a página: se vier de um link de recuperação de senha do Supabase
// (URL com #access_token=...&type=recovery), mostra direto a tela de nova senha.
(function detectarLinkRecuperacao(){
  const hash = location.hash || '';
  if(hash.includes('type=recovery')){
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const token = params.get('access_token');
    if(token){
      tokenRecuperacao = token;
      document.addEventListener('DOMContentLoaded', ()=>{
        authGoTab('novasenha');
        document.getElementById('authScreen').classList.add('open');
        document.getElementById('waitScreen').classList.remove('open');
        document.getElementById('blockScreen').classList.remove('open');
      });
    }
  }
})();

// Busca o perfil (papel/status) da pessoa logada na tabela "perfis"
async function authBuscarPerfil(){
  const sessao = authGetSessao();
  const uid = sessao?.user?.id;
  if(!uid) return null;
  try {
    const res = await fetch(sbUrlPerfis('?id=eq.'+uid+'&select=id,nome,papel,status,membro_id'), { headers: sbHeaders() });
    if(!res.ok) return null;
    const data = await res.json();
    return (data && data[0]) || null;
  } catch { return null; }
}
function sbUrlPerfis(filtros){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/perfis' + (filtros || '');
}

// ══ PERFIL (aba Conta → Perfil) ══
// Busca os campos extras (telefone, data de nascimento, foto, assinatura). Como esses
// campos podem não existir ainda na tabela "perfis" de quem está usando o app (é preciso
// rodar uma migração no Supabase pra criá-los), tenta o select completo e, se der erro
// de coluna inexistente, cai pro select básico (que sempre funciona) e usa valores padrão
// pro resto — assim a tela nunca quebra, só mostra os campos como vazios/"Teste Grátis".
const CAMPOS_PERFIL_EXTRA = 'nome,telefone,data_nascimento,foto_url,plano,assinatura_status,assinatura_inicio,assinatura_vencimento';
async function buscarPerfilCompleto(){
  if(!perfilAtual?.id) return { ok:false, dados:{} };
  try {
    const res = await fetch(sbUrlPerfis('?id=eq.'+perfilAtual.id+'&select='+CAMPOS_PERFIL_EXTRA), { headers: sbHeaders() });
    if(res.ok){
      const data = await res.json();
      return { ok:true, dados:(data && data[0]) || {} };
    }
  } catch {}
  // colunas extras ainda não existem nessa base — devolve só o que já sabemos ter (o nome)
  return { ok:false, dados: { nome: perfilAtual?.nome || '' } };
}

async function salvarPerfil(campos){
  if(!perfilAtual?.id) return { ok:false, msg:'Sessão não encontrada — faça login novamente.' };
  try {
    const res = await fetch(sbUrlPerfis('?id=eq.'+perfilAtual.id), {
      method:'PATCH', headers: { ...sbHeaders(), 'Prefer':'return=representation' },
      body: JSON.stringify(campos)
    });
    if(!res.ok){
      const t = await res.text();
      return { ok:false, msg: 'Não foi possível salvar — talvez faltem colunas na tabela "perfis" do Supabase (telefone, data_nascimento, foto_url). Detalhe: '+t };
    }
    if(campos.nome && perfilAtual) perfilAtual.nome = campos.nome;
    return { ok:true };
  } catch(e){
    return { ok:false, msg:'Erro de conexão: '+e.message };
  }
}

// Troca a senha de quem já está logado (usa o token da sessão atual, diferente do fluxo
// de "esqueci minha senha" que usa um token de recuperação vindo por e-mail).
async function alterarSenhaLogado(novaSenha){
  const sessao = authGetSessao();
  if(!sessao || !sessao.access_token) return { ok:false, msg:'Sessão expirada, faça login novamente.' };
  if(!novaSenha || novaSenha.length<6) return { ok:false, msg:'A senha precisa ter no mínimo 6 caracteres.' };
  try {
    const res = await fetch(authUrl('/user'), {
      method:'PUT',
      headers: { ...authHeadersBase(), 'Authorization':'Bearer '+sessao.access_token },
      body: JSON.stringify({ password: novaSenha })
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok) return { ok:false, msg: (data&&data.msg)||(data&&data.error_description)||'Erro ao alterar senha' };
    return { ok:true };
  } catch(e){
    return { ok:false, msg:'Erro de conexão: '+e.message };
  }
}
window.buscarPerfilCompleto = buscarPerfilCompleto;
window.salvarPerfil = salvarPerfil;
window.alterarSenhaLogado = alterarSenhaLogado;

// Roda depois de login/cadastro bem-sucedidos: decide qual tela mostrar
async function authIniciarSessao(){
  perfilAtual = await authBuscarPerfil();
  // Recarrega jogos e banca usando o token da sessão que acabou de logar —
  // antes do login, esses dados podem ter vindo vazios (bloqueados pelo RLS sem login).
  await carregarJogos();
  await bpCarregarNuvem();
  await cfgAppCarregarNuvem();
  await escudosCarregarNuvem();
  authAplicarTela();
}

// Decide entre: tela de login, espera de aprovação, ou app liberado
function authAplicarTela(){
  const elAuth  = document.getElementById('authScreen');
  const elWait  = document.getElementById('waitScreen');
  const elBlock = document.getElementById('blockScreen');

  elAuth.classList.remove('open');
  elWait.classList.remove('open');
  elBlock.classList.remove('open');
  document.body.classList.remove('papel-organizador','papel-membro');

  const sessao = authGetSessao();
  if(!sessao || !perfilAtual){
    elAuth.classList.add('open');
    const av = document.getElementById('userAvatar');
    if(av) av.style.display = 'none';
    return;
  }

  // Popula o avatar e o menu suspenso com dados do usuário
  const av = document.getElementById('userAvatar');
  if(av){
    av.textContent = '👤';
    av.style.display = 'flex';
  }
  const menuNome  = document.getElementById('menuNome');
  const menuEmail = document.getElementById('menuEmail');
  if(menuNome)  menuNome.textContent  = perfilAtual.nome  || '';
  if(menuEmail) menuEmail.textContent = sessao.email || perfilAtual.email || '';

  if(perfilAtual.papel === 'organizador'){
    // organizador sempre entra liberado e vê todos os botões de edição
    document.body.classList.add('papel-organizador');
    return;
  }

  // a partir daqui é membro: esconde botões de criar/editar/excluir em todo o app
  document.body.classList.add('papel-membro');

  if(perfilAtual.status !== 'aprovado'){
    elWait.classList.add('open');
    return;
  }

  // Checa bloqueio (Administração → Usuários → Bloquear). Consulta separada e tolerante a
  // falha: se a coluna "bloqueado" ainda não existir nessa base, simplesmente não bloqueia ninguém.
  authVerificarBloqueio();
}
async function authVerificarBloqueio(){
  try {
    const res = await fetch(sbUrlPerfis('?select=bloqueado'), { headers: sbHeaders() });
    if(!res.ok) return;
    const data = await res.json();
    if(data && data[0] && data[0].bloqueado){
      document.getElementById('blockScreen').classList.add('open');
    }
  } catch {}
  // membro aprovado: acesso liberado (a Banca agora é individual do organizador,
  // então não existe mais checagem de saldo pra liberar o acesso do membro).
}

// ══ APROVAÇÕES (organizador) — agora mora em Minha Conta → Administração ══
async function carregarPendentes(){
  const el = document.getElementById('listaPendentes');
  if(!el) return;
  try {
    const res = await fetch(sbUrlPerfis('?status=eq.pendente&select=id,nome,status'), { headers: sbHeaders() });
    if(!res.ok) throw new Error('Erro ao buscar pendentes');
    const lista = await res.json();
    if(!lista.length){
      el.innerHTML = '<div class="empty"><div class="icon">✅</div><p>Nenhum cadastro pendente.</p></div>';
      return;
    }
    el.innerHTML = lista.map(p=>`
      <div class="aprov-card">
        <div class="aprov-info">
          <div class="aprov-nome">${p.nome}</div>
        </div>
        <div class="aprov-btns">
          <button class="btn-aprovar" onclick="aprovarMembro('${p.id}')">✅ Aprovar</button>
          <button class="btn-rejeitar" onclick="rejeitarMembro('${p.id}')">✕ Rejeitar</button>
        </div>
      </div>
    `).join('');
  } catch(e){
    el.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>Erro ao carregar: ${e.message}</p></div>`;
  }
}

// Aprova só o acesso (a Banca agora é individual — não existe mais membro/cota na banca)
async function aprovarMembro(perfilId){
  try {
    const upd = await fetch(sbUrlPerfis('?id=eq.'+perfilId), {
      method:'PATCH', headers: { ...sbHeaders(), 'Prefer':'return=representation' },
      body: JSON.stringify({ status:'aprovado' })
    });
    if(!upd.ok){ const t = await upd.text(); throw new Error(t); }

    toast('✅ Membro aprovado!');
    carregarPendentes();
  } catch(e){
    toast('❌ Erro ao aprovar: ' + e.message, true);
  }
}

async function rejeitarMembro(perfilId){
  if(!confirm('Rejeitar este cadastro? A pessoa não terá acesso ao app.')) return;
  try {
    const res = await fetch(sbUrlPerfis('?id=eq.'+perfilId), {
      method:'PATCH', headers: sbHeaders(),
      body: JSON.stringify({ status:'rejeitado' })
    });
    if(!res.ok){ const t = await res.text(); throw new Error(t); }
    toast('🗑️ Cadastro rejeitado');
    carregarPendentes();
  } catch(e){
    toast('❌ Erro: ' + e.message, true);
  }
}

// URL base da tabela
function sbUrl(filtros) {
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/jogos' + (filtros || '');
}

function setSyncStatus(estado, msg) {
  const dot = document.getElementById('syncDot');
  const msgEl = document.getElementById('syncMsg');
  dot.className = 'sync-dot ' + estado;
  msgEl.textContent = msg;
}

