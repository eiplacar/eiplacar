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
// Sistema). Todo pagamento aqui é ÚNICO (Pix ou cartão/outro meio via
// Checkout Pro) — ninguém fica cadastrado pra cobrança automática. Quando o
// período acaba, a pessoa decide se quer voltar e pagar de novo.
function renderAssinar(){
  const el = document.getElementById('assinarPlanos');
  if(!el) return;
  const cfg = cfgAppLoad();
  const venceu = window.assinaturaVencida?.();
  const sub = document.getElementById('assinarSubtitulo');

  // Já tem um plano PAGO em dia (não é o teste grátis) — não deixa gerar
  // cobrança/Pix de novo à toa, só mostra que está tudo certo.
  const jaEmDia = perfilAtual?.assinatura_status === 'ativo' && !venceu;
  if(jaEmDia){
    if(sub) sub.textContent = 'Sua assinatura está em dia!';
    const nomePlano = perfilAtual.plano ? perfilAtual.plano.charAt(0).toUpperCase()+perfilAtual.plano.slice(1) : '';
    const podeCancelar = !!perfilAtual.assinatura_mp_id && !perfilAtual.assinatura_cancelada;
    el.innerHTML = `
      <div style="background:var(--c2);border:2px solid var(--verde2);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:13px;font-weight:700;color:var(--verde2);margin-bottom:4px">✅ Acesso ativo</div>
        <div style="font-size:12px;color:var(--texto2)">Plano ${nomePlano} • ${perfilAtual.assinatura_cancelada ? 'acesso até' : 'válido até'} ${window.fd?.(perfilAtual.assinatura_vencimento) || perfilAtual.assinatura_vencimento}</div>
        ${perfilAtual.assinatura_cancelada
          ? `<div style="font-size:10.5px;color:var(--texto2);margin-top:10px">Cancelada — não vai renovar sozinha.</div>`
          : podeCancelar
            ? `<button onclick="cancelarAssinaturaTela()" style="margin-top:12px;background:none;border:1px solid var(--perigo);color:var(--perigo);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">Cancelar assinatura recorrente</button>`
            : `<div style="font-size:10.5px;color:var(--texto2);margin-top:10px">Pagamento único — não renova sozinho. Quando vencer, você decide se paga de novo.</div>`
        }
      </div>`;
    return;
  }

  if(sub) sub.textContent = venceu
    ? 'Seu período de teste grátis acabou. Faça um pagamento único para continuar.'
    : 'Continue com acesso liberado a tudo do EI PLACAR.';

  const planos = [
    { id:'mensal',      nome:'Mensal',      preco:cfg.precoMensal,      obs:'30 dias de acesso' },
    { id:'trimestral',  nome:'Trimestral',  preco:cfg.precoTrimestral,  obs:'90 dias de acesso' },
    { id:'semestral',   nome:'Semestral',   preco:cfg.precoSemestral,   obs:'180 dias de acesso' },
  ];
  el.innerHTML = planos.map(p=>`
    <div style="background:var(--c2);border:2px solid var(--c3);border-radius:12px;padding:14px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div>
          <div style="font-size:14px;font-weight:800">${p.nome}</div>
          <div style="font-size:10.5px;color:var(--texto2)">${p.obs} • pagamento único</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:900;color:var(--ouro)">R$ ${Number(p.preco||0).toFixed(2).replace('.',',')}</div>
          <button onclick="iniciarAssinatura('${p.id}')" style="margin-top:4px;background:var(--verde2);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer">Pagar</button>
        </div>
      </div>
      ${p.id==='mensal' ? `<button onclick="abrirModalPix()" style="margin-top:10px;width:100%;background:none;border:1px dashed var(--texto2);color:var(--texto2);border-radius:8px;padding:6px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px"><span data-ic="qrCode" data-ic-size="13"></span>Pagar só este mês com Pix</button>` : ''}
    </div>`).join('');
  renderIcons(el);
}
window.renderAssinar = renderAssinar;

// Apesar do nome (mantido por compatibilidade com a function/endpoint),
// isso hoje gera um PAGAMENTO ÚNICO via Checkout Pro — não cadastra cartão
// pra cobrança automática nenhuma. Ver netlify/functions/criar-assinatura.js.
async function iniciarAssinatura(planoId){
  const btns = document.querySelectorAll('#assinarPlanos button');
  btns.forEach(b=>{ b.disabled = true; b.style.opacity = .6; });
  try {
    const sessao = authGetSessao();
    const res = await fetch('/.netlify/functions/criar-assinatura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (sessao?.access_token || '') },
      body: JSON.stringify({ planoId }),
    });
    const data = await res.json();
    if(!res.ok || !data.checkoutUrl) throw new Error(data.erro || 'Não foi possível gerar o checkout');
    window.location.href = data.checkoutUrl; // manda pra página segura do Mercado Pago
  } catch(e){
    toast('Erro ao iniciar assinatura: ' + e.message, true);
    btns.forEach(b=>{ b.disabled = false; b.style.opacity = 1; });
  }
}
window.iniciarAssinatura = iniciarAssinatura;

async function cancelarAssinaturaTela(){
  if(!confirm('Cancelar a renovação automática? Você continua com acesso até ' + (window.fd?.(perfilAtual.assinatura_vencimento) || perfilAtual.assinatura_vencimento) + ', só não vai ser cobrado(a) de novo depois disso.')) return;
  try {
    const sessao = authGetSessao();
    const res = await fetch('/.netlify/functions/cancelar-assinatura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (sessao?.access_token || '') },
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.erro || 'Não foi possível cancelar');
    perfilAtual.assinatura_cancelada = true;
    toast('Assinatura cancelada. Seu acesso continua até o vencimento.');
    renderAssinar();
  } catch(e){
    toast('Erro ao cancelar: ' + e.message, true);
  }
}
window.cancelarAssinaturaTela = cancelarAssinaturaTela;

// ══ PIX AVULSO (1 mês, sem renovação automática) ══
let pixPollTimer = null;

function abrirModalPix(){
  document.getElementById('pixEtapaCpf').style.display = 'block';
  document.getElementById('pixEtapaQr').style.display = 'none';
  document.getElementById('pixCpf').value = '';
  const cfg = cfgAppLoad();
  document.getElementById('pixValor').textContent = Number(cfg.precoMensal||0).toFixed(2).replace('.',',');
  document.getElementById('modalPix').classList.add('open');
}
window.abrirModalPix = abrirModalPix;

function fecharModalPix(){
  document.getElementById('modalPix').classList.remove('open');
  if(pixPollTimer){ clearInterval(pixPollTimer); pixPollTimer = null; }
}
window.fecharModalPix = fecharModalPix;

async function gerarPagamentoPix(){
  const cpf = document.getElementById('pixCpf').value.replace(/\D/g,'');
  if(cpf.length !== 11){ toast('Digite um CPF válido!'); return; }
  try {
    const sessao = authGetSessao();
    const res = await fetch('/.netlify/functions/criar-pagamento-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (sessao?.access_token || '') },
      body: JSON.stringify({ cpf }),
    });
    const data = await res.json();
    if(!res.ok || !data.qrCode) throw new Error(data.erro || 'Não foi possível gerar o Pix');

    document.getElementById('pixEtapaCpf').style.display = 'none';
    document.getElementById('pixEtapaQr').style.display = 'block';
    document.getElementById('pixQrImg').src = 'data:image/png;base64,' + data.qrCodeBase64;
    document.getElementById('pixCopiaCola').value = data.qrCode;
    document.getElementById('pixStatus').textContent = '⏳ Aguardando confirmação do pagamento...';

    // Fica checando o status DESSE pagamento específico direto no Mercado
    // Pago (não só "a assinatura tá liberada?", porque isso pode já estar
    // liberado por outro motivo — teste grátis, plano anterior — e daria
    // falso positivo antes da pessoa pagar de verdade).
    if(pixPollTimer) clearInterval(pixPollTimer);
    let tentativas = 0;
    pixPollTimer = setInterval(async () => {
      tentativas++;
      if(tentativas > 300){ clearInterval(pixPollTimer); pixPollTimer = null; document.getElementById('pixStatus').textContent = '⌛ Esse código Pix expirou. Feche e gere um novo.'; return; } // 30min (mesmo prazo do date_of_expiration) e desiste de checar sozinho
      try {
        const resStatus = await fetch('/.netlify/functions/verificar-pagamento-pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (authGetSessao()?.access_token || '') },
          body: JSON.stringify({ paymentId: data.paymentId }),
        });
        const statusData = await resStatus.json();
        if(statusData.status === 'approved'){
          clearInterval(pixPollTimer); pixPollTimer = null;
          await window.perfilAtualRecarregarAssinatura?.(); // verificar-pagamento-pix já liberou o acesso antes de responder "approved"
          document.getElementById('pixStatus').textContent = '✅ Pagamento confirmado! Acesso liberado.';
          toast('Pagamento confirmado! Seu acesso já está liberado.');
          setTimeout(()=>{ fecharModalPix(); goTo('geral'); }, 1500);
        } else if(statusData.status === 'rejected' || statusData.status === 'cancelled'){
          clearInterval(pixPollTimer); pixPollTimer = null;
          document.getElementById('pixStatus').textContent = '❌ Pagamento não aprovado. Tente gerar um novo Pix.';
        }
      } catch {} // erro passageiro de rede — tenta de novo na próxima
    }, 6000);
  } catch(e){
    toast('Erro ao gerar Pix: ' + e.message, true);
  }
}
window.gerarPagamentoPix = gerarPagamentoPix;

function copiarPix(){
  const campo = document.getElementById('pixCopiaCola');
  campo.select();
  navigator.clipboard?.writeText(campo.value).then(()=>toast('Código Pix copiado!')).catch(()=>{});
}
window.copiarPix = copiarPix;

// ══ VOLTA DO CHECKOUT DE CARTÃO (Checkout Pro) ══
// O Mercado Pago devolve a pessoa pra APP_URL com ?payment_id=...&status=...
// na URL depois de pagar (ver back_urls/auto_return em criar-assinatura.js).
// Confere esse pagamento específico na hora — mesma function que o Pix usa
// pra checar status — em vez de depender só do webhook, que pode demorar
// alguns segundos pra chegar.
async function verificarRetornoPagamentoCartao(){
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment_id') || params.get('collection_id');
  const status = params.get('status') || params.get('collection_status');
  if(!paymentId) return; // não voltou de um checkout — nada a fazer

  // Limpa a URL pra não tentar checar de novo se a pessoa recarregar a página.
  try {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
  } catch {}

  if(status === 'rejected'){
    toast('Pagamento não aprovado pelo Mercado Pago. Tente novamente ou use outro cartão.', true);
    return;
  }
  if(status === 'pending' || status === 'in_process'){
    toast('Pagamento em análise. Assim que for aprovado, seu acesso é liberado automaticamente.');
    return;
  }

  try {
    const sessao = authGetSessao();
    if(!sessao?.access_token) return; // sem sessão aqui não tem como validar — o webhook ainda libera sozinho
    const res = await fetch('/.netlify/functions/verificar-pagamento-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.access_token },
      body: JSON.stringify({ paymentId }),
    });
    const data = await res.json();
    if(data.status === 'approved'){
      await window.perfilAtualRecarregarAssinatura?.();
      toast('Pagamento confirmado! Seu acesso já está liberado.');
      goTo('geral');
    }
  } catch {} // erro passageiro — o webhook é o reforço pra liberar de qualquer forma
}
window.verificarRetornoPagamentoCartao = verificarRetornoPagamentoCartao;

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
