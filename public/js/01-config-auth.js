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
// Salva a sessão. Em celulares com pouco espaço livre, o localStorage do navegador
// pode encher com o tempo (cache de escudos em base64, backups locais da Banca de
// contas antigas etc.) e aí até um dado pequeno como a sessão falha ao salvar
// ("QuotaExceededError") — isso travava o login pra sempre nesse aparelho, mesmo
// com e-mail/senha corretos. Agora, se acontecer, libera espaço apagando só os
// caches "de emergência" (tudo isso volta sozinho da nuvem depois do login) e
// tenta salvar a sessão de novo antes de desistir.
function authSaveSessao(s){
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(s));
  } catch(e){
    if(!/quota/i.test(e.name||'') && !/quota/i.test(e.message||'')) throw e;
    try {
      localStorage.removeItem('mp_escudos'); // cache de escudos (imagens) — recarrega da nuvem
      Object.keys(localStorage).forEach(k=>{
        // backups locais da Banca (por conta) e config do app — idem, voltam da nuvem
        if(k.startsWith('bancaParticipantes_v2_') || k === 'eiPlacar_configApp') localStorage.removeItem(k);
      });
      localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    } catch(e2){
      console.error('Não foi possível salvar a sessão mesmo após limpar cache local:', e2);
      throw e2;
    }
  }
}
function authClearSessao(){ localStorage.removeItem(AUTH_KEY); }

// ── Renovação automática de sessão ──
// Antes disso, o app pegava o token no login e nunca trocava por um novo — depois de
// ~1h (validade padrão do Supabase) toda chamada passava a falhar com "JWT expired"
// pra sempre, e a única saída era sair e entrar de novo. Agora: 1) confere de tempos
// em tempos se falta pouco pra expirar e renova sozinho em segundo plano (o normal é
// a pessoa nunca ver esse erro); 2) se mesmo assim uma chamada falhar por token
// vencido, tenta renovar e repetir na hora — só pede login de novo se o refresh_token
// (validade de dias, não horas) também já tiver expirado.
async function authRefreshSessao(){
  const sessao = authGetSessao();
  if(!sessao?.refresh_token) return false;
  try {
    const res = await fetch(authUrl('/token?grant_type=refresh_token'), {
      method: 'POST', headers: authHeadersBase(),
      body: JSON.stringify({ refresh_token: sessao.refresh_token })
    });
    const data = await res.json();
    if(!res.ok || !data.access_token) return false;
    authSaveSessao(data);
    return true;
  } catch(e){ return false; }
}
async function authRenovarSeNecessario(){
  const sessao = authGetSessao();
  if(!sessao?.access_token || !sessao?.expires_at) return;
  const faltamSegundos = sessao.expires_at - Math.floor(Date.now()/1000);
  if(faltamSegundos < 300) await authRefreshSessao(); // menos de 5min pra vencer: renova já
}
setInterval(authRenovarSeNecessario, 4*60*1000); // confere a cada 4 minutos

// Erro de token vencido que "escapou" da renovação automática (ex: celular ficou
// horas com a tela apagada) — reconhece pela mensagem que o Supabase manda.
function ehErroSessaoExpirada(msg){ return /jwt expired|pgrst303/i.test(msg||''); }

function authMostrarMsg(texto, tipo){
  const el = document.getElementById('authMsg');
  el.innerHTML = '';
  const icone = document.createElement('span');
  icone.className = 'auth-msg-ic';
  icone.setAttribute('data-ic', tipo==='ok' ? 'circleCheck' : tipo==='erro' ? 'circleAlert' : 'circleDot');
  icone.setAttribute('data-ic-size', '14');
  const spanTexto = document.createElement('span');
  spanTexto.textContent = texto;
  el.append(icone, spanTexto);
  window.renderIcons?.(el);
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

// ── Termos de Uso / Política de Privacidade (modal no cadastro) ──
function abrirModalTermos(){
  document.getElementById('modalTermos').classList.add('open');
}
function fecharModalTermos(){
  document.getElementById('modalTermos').classList.remove('open');
}
function aceitarTermosNoModal(){
  const chk = document.getElementById('cadAceiteTermos');
  if(chk) chk.checked = true;
  authAtualizarBotaoCadastro();
  fecharModalTermos();
}
// Botão "Criar Conta" só libera depois que a pessoa marcar o aceite dos termos —
// trava na interface além da checagem que fazerCadastro() já faz por segurança.
function authAtualizarBotaoCadastro(){
  const chk = document.getElementById('cadAceiteTermos');
  const btn = document.getElementById('btnCriarConta');
  if(btn) btn.disabled = !(chk && chk.checked);
}

// ── Validações do cadastro ──
// Nome "de verdade": exige nome + sobrenome (2+ palavras com pelo menos 2 letras cada),
// pra barrar quem digita só "-", "." ou uma letra qualquer pra passar pelo campo obrigatório.
function nomeCompletoValido(nome){
  const partes = nome.split(/\s+/).filter(p => p.replace(/[^A-Za-zÀ-ÿ]/g,'').length >= 2);
  return partes.length >= 2;
}
// E-mail em formato básico válido (checagem simples, o Supabase confirma de verdade por trás).
function emailValido(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// Telefone: exige DDD + número, ignorando parênteses/traço/espaço (10 ou 11 dígitos no Brasil).
function telefoneValido(telefone){
  const digitos = telefone.replace(/\D/g,'');
  return digitos.length >= 10 && digitos.length <= 11;
}
// Idade mínima de 18 anos, conforme os Termos de Uso.
function maiorDeIdade(dataNascimento){
  const nasc = new Date(dataNascimento + 'T00:00:00');
  if(isNaN(nasc.getTime())) return false;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const aindaNaoFezAniversario = (hoje.getMonth() < nasc.getMonth()) ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate());
  if(aindaNaoFezAniversario) idade--;
  return idade >= 18;
}

// ── CADASTRO ──
async function fazerCadastro(){
  const nome  = document.getElementById('cadNome').value.trim().replace(/\s+/g,' ');
  const email = document.getElementById('cadEmail').value.trim();
  const telefone = document.getElementById('cadTelefone').value.trim();
  const dataNascimento = document.getElementById('cadDataNascimento').value;
  const senha = document.getElementById('cadSenha').value;
  const aceitouTermos = document.getElementById('cadAceiteTermos')?.checked;
  authLimparMsg();
  if(!nome || !nomeCompletoValido(nome)) { authMostrarMsg('️ Informe seu nome completo (nome e sobrenome)','erro'); return; }
  if(!email || !emailValido(email)) { authMostrarMsg('️ Informe um e-mail válido','erro'); return; }
  if(!telefone || !telefoneValido(telefone)) { authMostrarMsg('️ Informe um telefone válido, com DDD','erro'); return; }
  if(!dataNascimento) { authMostrarMsg('️ Informe sua data de nascimento','erro'); return; }
  if(!maiorDeIdade(dataNascimento)) { authMostrarMsg('️ O EI PLACAR é destinado a maiores de 18 anos','erro'); return; }
  if(!senha||senha.length<6){ authMostrarMsg('️ A senha precisa ter no mínimo 6 caracteres','erro'); return; }
  if(!aceitouTermos){ authMostrarMsg('️ É preciso ler e aceitar os Termos de Uso e a Política de Privacidade','erro'); return; }

  // Limpa qualquer sessão que já estivesse salva neste navegador (ex: admin testando
  // o cadastro) ANTES de criar a conta nova — evita continuar "logado" na conta antiga
  // caso essa conta nova precise confirmar e-mail antes de poder entrar.
  authClearSessao();
  perfilAtual = null;

  try {
    const res = await fetch(authUrl('/signup'), {
      method:'POST', headers: authHeadersBase(),
      body: JSON.stringify({ email, password: senha, data: { nome, telefone, data_nascimento: dataNascimento } })
    });
    let data = {};
    try { data = await res.json(); } catch {} // corpo vazio/inesperado não pode derrubar a função sem mostrar nada
    if(!res.ok){
      const msg = (data && data.msg) || (data && data.error_description) || 'Erro ao criar conta';
      if(msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')){
        authMostrarMsg('️ Este e-mail já possui conta. Tente entrar.','erro');
      } else {
        authMostrarMsg('️'+ msg,'erro');
      }
      return;
    }
    if(data.access_token){
      authSaveSessao(data);
      await authIniciarSessao();
      // Início do teste grátis — tentativa silenciosa; se as colunas de assinatura ainda não
      // existirem nessa base, não faz diferença nenhuma pro login (só não mostra prazo na aba Conta).
      const dias = (cfgAppLoad().diasTeste) || 60;
      const hoje = hojeBR(); // corrigido pro fuso de Brasília (ver 04-utils.js)
      salvarPerfil({ assinatura_status:'trial', assinatura_inicio:hoje, assinatura_vencimento: hojeBR(dias) }).catch(()=>{});
      // Telefone/data de nascimento/e-mail: o gatilho do banco (handle_new_user, ver
      // supabase/04-tabela-perfis.sql) já grava isso direto na criação da conta, então
      // esse PATCH aqui é só um reforço (ex: base antiga sem a migração mais recente).
      // Antes, um erro aqui era 100% silencioso (.catch(()=>{}) sem log nenhum) — se
      // falhasse, a pessoa preenchia telefone/nascimento no cadastro e eles simplesmente
      // sumiam, sem nenhum aviso. Agora ao menos fica registrado no console pra investigar.
      salvarPerfil({ telefone, data_nascimento: dataNascimento, email, termos_aceitos_em: new Date().toISOString() })
        .then(r=>{ if(!r.ok) console.warn('Não foi possível salvar telefone/nascimento/e-mail no perfil (o gatilho do banco deve ter coberto isso mesmo assim):', r.msg); })
        .catch(e=>console.warn('Erro ao salvar dados extras do perfil:', e));
    } else if(data.user && Array.isArray(data.user.identities) && data.user.identities.length===0){
      // O Supabase, por segurança, não revela se o e-mail já existe: quando a confirmação por
      // e-mail está ativada, um cadastro repetido volta como "sucesso" mas com identities:[] —
      // esse é o sinal de que já existe conta com esse e-mail.
      authMostrarMsg('️ Este e-mail já possui conta. Tente entrar ou recupere sua senha.','erro');
      authAplicarTela();
    } else {
      // projeto com confirmação por e-mail ativada
      authMostrarMsg('Conta criada! Verifique seu e-mail para confirmar, depois faça login.','ok');
      authAplicarTela();
      // Espera a pessoa ler a mensagem antes de trocar de aba — authGoTab() limpa a
      // mensagem da tela (authLimparMsg no final dela), então chamar isso na hora
      // apagava o aviso "Conta criada!" antes de aparecer, dando a impressão de que
      // o cadastro simplesmente falhou e voltou pro login sem dizer nada.
      setTimeout(()=>authGoTab('login'), 3000);
    }
  } catch(e){
    authMostrarMsg('️ Não foi possível conectar. Verifique sua internet e tente novamente.','erro');
  }
}

// Traduz os erros que o Supabase Auth devolve (em inglês, por códigos) pra
// mensagens em português que dizem pra pessoa o que aconteceu de verdade —
// antes disso, alguns retornos (corpo vazio, formato inesperado) faziam a
// tela não mostrar mensagem NENHUMA quando o login falhava.
function mensagemErroLogin(data){
  const codigo = ((data && (data.error_code || data.code || data.error)) || '').toLowerCase();
  const bruto = ((data && (data.error_description || data.msg)) || '').toLowerCase();
  const junto = codigo + ' ' + bruto;
  if(/invalid.*credentials|invalid_grant/.test(junto)){
    return '️ E-mail ou senha inválidos. Confira os dados e tente novamente.';
  }
  if(/email.*not.*confirmed/.test(junto)){
    return '️ Confirme seu e-mail antes de entrar — verifique sua caixa de entrada (e o spam).';
  }
  if(/too many requests|rate limit/.test(junto)){
    return '️ Muitas tentativas seguidas. Aguarde um instante e tente novamente.';
  }
  if(/user.*banned|user.*disabled/.test(junto)){
    return '️ Esta conta está bloqueada. Fale com o organizador.';
  }
  return '️ Não foi possível entrar. Confira o e-mail e a senha e tente novamente.';
}

// ── LOGIN ──
async function fazerLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  authLimparMsg();
  if(!email||!senha){ authMostrarMsg('️ Informe e-mail e senha','erro'); return; }
  if(!emailValido(email)){ authMostrarMsg('️ Digite um e-mail válido','erro'); return; }

  const btn = document.querySelector('#aform-login .btn-primary');
  if(btn){ btn.disabled = true; btn.style.opacity = .6; }
  try {
    const res = await fetch(authUrl('/token?grant_type=password'), {
      method:'POST', headers: authHeadersBase(),
      body: JSON.stringify({ email, password: senha })
    });
    // O corpo pode vir vazio ou num formato inesperado em alguns erros de rede/
    // proxy — sem esse try/catch, um JSON inválido derrubava a função inteira
    // antes de mostrar qualquer mensagem, e a tela ficava exatamente como
    // estava (botão apertado, nada acontece).
    let data = {};
    try { data = await res.json(); } catch {}
    if(!res.ok){
      authMostrarMsg(mensagemErroLogin(data), 'erro');
      return;
    }
    authSaveSessao(data);
    await authIniciarSessao();
  } catch(e){
    authMostrarMsg('️ Não foi possível conectar. Verifique sua internet e tente novamente.','erro');
  } finally {
    if(btn){ btn.disabled = false; btn.style.opacity = 1; }
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
  if (typeof bancaCache !== 'undefined') bancaCache = null;
  // Limpa campos de login
  const el = document.getElementById('loginEmail'); if(el) el.value='';
  const es = document.getElementById('loginSenha'); if(es) es.value='';
  authAplicarTela();
}

// ── Mostrar/ocultar senha (ícone de olho) ──
function togglePwd(id, btn){
  const el = document.getElementById(id);
  const mostrar = el.type === 'password';
  el.type = mostrar ? 'text' : 'password';
  btn.innerHTML = ic(mostrar ? 'eyeOff' : 'eye', 16);
}

// ── Recuperar senha: envia e-mail com link via Supabase Auth ──
async function enviarRecuperacaoSenha(){
  const email = document.getElementById('recEmail').value.trim();
  authLimparMsg();
  if(!email){ authMostrarMsg('️ Informe seu e-mail','erro'); return; }
  try {
    const res = await fetch(authUrl('/recover'), {
      method:'POST', headers: authHeadersBase(),
      body: JSON.stringify({ email, redirect_to: location.origin + location.pathname })
    });
    // O Supabase responde 200 mesmo se o e-mail não existir (por segurança, não revela quais e-mails têm conta)
    if(res.ok){
      authMostrarMsg('Se esse e-mail tiver conta, enviamos um link de recuperação. Verifique sua caixa de entrada (e o spam).','ok');
    } else {
      const data = await res.json().catch(()=>({}));
      authMostrarMsg('️'+ ((data&&data.msg)||(data&&data.error_description)||'Erro ao enviar e-mail'),'erro');
    }
  } catch(e){
    authMostrarMsg('Erro de conexão:'+ e.message,'erro');
  }
}

// ── Define a nova senha, usando o token que veio no link do e-mail (na URL) ──
let tokenRecuperacao = null;
async function salvarNovaSenha(){
  const senha = document.getElementById('novaSenha').value;
  authLimparMsg();
  if(!senha||senha.length<6){ authMostrarMsg('️ A senha precisa ter no mínimo 6 caracteres','erro'); return; }
  if(!tokenRecuperacao){ authMostrarMsg('️ Link inválido ou expirado. Solicite a recuperação novamente.','erro'); return; }
  try {
    const res = await fetch(authUrl('/user'), {
      method:'PUT',
      headers: { ...authHeadersBase(), 'Authorization': 'Bearer ' + tokenRecuperacao },
      body: JSON.stringify({ password: senha })
    });
    const data = await res.json();
    if(!res.ok){
      authMostrarMsg('️'+ ((data&&data.msg)||(data&&data.error_description)||'Erro ao salvar nova senha'),'erro');
      return;
    }
    authMostrarMsg('Senha alterada! Faça login com a nova senha.','ok');
    history.replaceState(null, '', location.pathname); // limpa o token da URL
    setTimeout(()=>authGoTab('login'), 1500);
  } catch(e){
    authMostrarMsg('Erro de conexão:'+ e.message,'erro');
  }
}

// Ao abrir a página: se vier de um link de confirmação de CADASTRO do Supabase
// (URL com #access_token=...&type=signup), loga a pessoa direto — sem isso, o token
// era simplesmente ignorado e a pessoa caía na tela de login mesmo já com um token
// válido na mão (e ainda podia aparecer toast de erro tentando carregar dados sem
// sessão nenhuma, antes de decidir isso).
(function detectarLinkConfirmacaoSignup(){
  const hash = location.hash || '';
  if(hash.includes('access_token') && (hash.includes('type=signup') || hash.includes('type=email_confirmation') || hash.includes('type=invite'))){
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if(!access_token) return;
    document.addEventListener('DOMContentLoaded', async ()=>{
      try {
        const res = await fetch(authUrl('/user'), { headers: { ...authHeadersBase(), 'Authorization': 'Bearer ' + access_token } });
        const user = await res.json();
        if(res.ok && user && user.id){
          authSaveSessao({ access_token, refresh_token, user });
          history.replaceState(null, '', location.pathname); // limpa o token da URL, não fica exposto/reaproveitável
          await authIniciarSessao();
        }
      } catch(e) { /* se der erro, cai no fluxo normal (tela de login) sem travar nada */ }
    });
  }
})();

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
    const res = await fetch(sbUrlPerfis('?id=eq.'+uid+'&select=id,nome,papel,status,membro_id,assinatura_status,assinatura_vencimento'), { headers: sbHeaders() });
    if(!res.ok) return null;
    const data = await res.json();
    return (data && data[0]) || null;
  } catch { return null; }
}
function sbUrlPerfis(filtros){
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/perfis' + (filtros || '');
}

// ══ Trava de assinatura ══ — organizador nunca é afetado (é quem administra o
// sistema). Pra membro: vencido = status "cancelado" OU data de vencimento já
// passou. Sem data de vencimento (base antiga sem migração, ou perfil recém-criado
// antes do trial gravar) não bloqueia — evita travar todo mundo por engano.
function assinaturaVencida(){
  if(!perfilAtual || perfilAtual.papel === 'organizador') return false;
  if(perfilAtual.assinatura_status === 'cancelado') return true;
  const venc = perfilAtual.assinatura_vencimento;
  if(!venc) return false;
  return venc < hojeBR();
}
window.assinaturaVencida = assinaturaVencida;

// Busca de novo só os campos de assinatura e atualiza o perfilAtual global —
// usado no polling da tela de Pix avulso, pra saber quando o webhook liberou
// o acesso sem precisar que a pessoa esteja na tela de Minha Conta (que só
// atualiza seu próprio estado local, não o perfilAtual usado pela trava).
async function perfilAtualRecarregarAssinatura(){
  if(!perfilAtual?.id) return;
  try {
    const res = await fetch(sbUrlPerfis('?id=eq.'+perfilAtual.id+'&select=assinatura_status,assinatura_vencimento'), { headers: sbHeaders() });
    const data = res.ok ? await res.json() : [];
    if(data?.[0]) Object.assign(perfilAtual, data[0]);
  } catch {}
}
window.perfilAtualRecarregarAssinatura = perfilAtualRecarregarAssinatura;

// ══ PERFIL (aba Conta → Perfil) ══
// Busca os campos extras (telefone, data de nascimento, foto, assinatura). Como esses
// campos podem não existir ainda na tabela "perfis" de quem está usando o app (é preciso
// rodar uma migração no Supabase pra criá-los), tenta o select completo e, se der erro
// de coluna inexistente, cai pro select básico (que sempre funciona) e usa valores padrão
// pro resto — assim a tela nunca quebra, só mostra os campos como vazios/"Teste Grátis".
const CAMPOS_PERFIL_EXTRA = 'nome,telefone,data_nascimento,foto_url,plano,assinatura_status,assinatura_inicio,assinatura_vencimento,assinatura_mp_id,assinatura_cancelada';
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
  // As 4 chamadas abaixo são independentes entre si (tabelas diferentas: jogos, banca,
  // config_app, escudos) — rodar em paralelo em vez de uma atrás da outra corta o tempo
  // de espera de "4 viagens de rede" pra "1", o que era a causa da demora no login e no
  // aparecimento das telas da Banca.
  await Promise.all([
    carregarJogos(),
    bpCarregarNuvem(),
    cfgAppCarregarNuvem(),
    escudosCarregarNuvem(),
    ophCarregarNuvem().then(()=>ophRenderLista?.()),
    favIndiceCarregarNuvem().then(()=>window.favIndiceRefresh?.()),
  ]);
  authAplicarTela();
}

// Decide entre: tela de login, espera de aprovação, ou app liberado
function authAplicarTela(){
  const elAuth  = document.getElementById('authScreen');
  const elBlock = document.getElementById('blockScreen');

  elAuth.classList.remove('open');
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
    av.innerHTML = ic('user', 16);
    av.style.display = 'flex';
  }
  const menuNome  = document.getElementById('menuNome');
  const menuEmail = document.getElementById('menuEmail');
  if(menuNome)  menuNome.textContent  = perfilAtual.nome  || '';
  if(menuEmail) menuEmail.textContent = sessao.user?.email || perfilAtual.email || '';

  if(perfilAtual.papel === 'organizador'){
    // organizador sempre entra liberado e vê todos os botões de edição
    document.body.classList.add('papel-organizador');
    return;
  }

  // a partir daqui é membro: esconde botões de criar/editar/excluir em todo o app
  document.body.classList.add('papel-membro');

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


// URL base da tabela
function sbUrl(filtros) {
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/jogos' + (filtros || '');
}

// URL base da tabela "Jogos Agendados" (Dashboard/Oportunidades) — compartilhada
// entre todas as contas (ver public/js/11-jogosdodia.js)
function sbUrlAgendados(filtros) {
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/jogos_agendados' + (filtros || '');
}

function setSyncStatus(estado, msg) {
  const dot = document.getElementById('syncDot');
  const msgEl = document.getElementById('syncMsg');
  const bar = document.querySelector('.sync-bar');
  dot.className = 'sync-dot ' + estado;
  msgEl.textContent = msg;
  const clicavel = estado === 'erro' && /sessão expirada/i.test(msg + ''); // só a mensagem de sessão expirada é clicável
  if(bar){
    bar.style.cursor = clicavel ? 'pointer' : '';
    bar.onclick = clicavel ? () => { authClearSessao(); location.reload(); } : null;
  }
}

