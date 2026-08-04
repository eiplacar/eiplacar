// ═══════════════════════════════════════════════════
// UTILITÁRIOS — formatação de data, ordenação, matemática de probabilidade (Poisson), toast
// ═══════════════════════════════════════════════════
// ══ HELPERS ══
const fd  = s => { if(!s) return '—'; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; };
const res = (gC,gV) => gC>gV?'<span class="badge-result badge-v">V</span>':gC===gV?'<span class="badge-result badge-e">E</span>':'<span class="badge-result badge-d">D</span>';
const r2  = n => Math.round(n*100)/100;

// CAUSA DO "DIA VIRA ÀS 21H" (investigado): `new Date().toISOString()` sempre usa o fuso
// UTC, não o fuso de quem está usando o app. Às 21h em Brasília (UTC-3) já é 00h em UTC —
// ou seja, o app achava que já tinha virado o dia 3 horas mais cedo do que realmente virou,
// e por isso não dava pra anotar os jogos da noite com a data certa (o campo de data já
// vinha preenchido com "amanhã"). O Brasil não tem mais horário de verão desde 2019, então
// o fuso de Brasília é sempre UTC-3, mas usar a timezone "America/Sao_Paulo" (em vez de fixar
// "-3" na unha) já deixa à prova de qualquer mudança futura na lei do horário de verão.
// `offsetDias`: 0 = hoje, -1 = ontem, 1 = amanhã, etc.
function hojeBR(offsetDias = 0){
  const alvo = new Date(Date.now() + offsetDias * 86400000);
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(alvo);
  const obj = {};
  partes.forEach(p => { obj[p.type] = p.value; });
  return `${obj.year}-${obj.month}-${obj.day}`;
}
// Ordenação natural: "Bundesliga" vem antes de "Bundesliga 2", e "Bundesliga 2" antes de "Bundesliga 10"
// (ordenação alfabética pura colocaria "Bundesliga 10" antes de "Bundesliga 2").
const sortNatural = arr => [...arr].sort((a,b)=>a.localeCompare(b, 'pt-BR', { numeric:true, sensitivity:'base' }));

// Amistoso(s) e Copa do Mundo não são ligas de verdade — sempre ficam por último nas listas de campeonato.
function comEspeciaisPorUltimo(camps){
  const especiais = camps.filter(c=>/amistoso|copa do mundo/i.test(c)).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const normais   = camps.filter(c=>!/amistoso|copa do mundo/i.test(c));
  return [...normais, ...especiais];
}

// ── País de cada campeonato — FALLBACK só pra jogos antigos que ainda não têm o
// campo `pais` preenchido no banco (ver supabase/09-adicionar-coluna-pais.sql).
// Todo jogo novo já vem com país real, digitado no cadastro — não precisa mais
// adivinhar pelo nome. Esse dicionário deixa de ser necessário assim que todos
// os jogos antigos forem migrados; mantido aqui só como rede de segurança.
const PAIS_CAMPEONATO = {
  'Série A': 'Brasil', 'Série B': 'Brasil', 'Série C': 'Brasil', 'Série D': 'Brasil',
  'Copa do Brasil': 'Brasil', 'Carioca': 'Brasil', 'Paulista': 'Brasil', 'Mineiro': 'Brasil', 'Gaúcho': 'Brasil',
  'Serie A': 'Itália', 'Serie B': 'Itália', 'Coppa Italia': 'Itália',
  'Premier League': 'Inglaterra', 'Championship': 'Inglaterra', 'FA Cup': 'Inglaterra', 'EFL Cup': 'Inglaterra',
  'La Liga': 'Espanha', 'La Liga 2': 'Espanha', 'Copa del Rey': 'Espanha',
  'Bundesliga': 'Alemanha', '2. Bundesliga': 'Alemanha', 'DFB Pokal': 'Alemanha',
  'Ligue 1': 'França', 'Ligue 2': 'França',
  'Primeira Liga': 'Portugal',
  'Eredivisie': 'Holanda',
  'Liga Profesional': 'Argentina', 'Copa Argentina': 'Argentina',
  'Liga MX': 'México',
  'MLS': 'Estados Unidos',
  'Champions League': 'Europa', 'Europa League': 'Europa', 'Conference League': 'Europa',
  'Libertadores': 'América do Sul', 'Sul-Americana': 'América do Sul',
  'Copa do Mundo': 'Mundial',
};
function paisDoCampeonato(nomeCamp){
  if(!nomeCamp) return '';
  if(PAIS_CAMPEONATO[nomeCamp]) return PAIS_CAMPEONATO[nomeCamp];
  // Tenta pelo nome-base (ex: "Bundesliga 2" cai no mesmo país de "Bundesliga")
  const base = nomeCamp.replace(/\s+([A-Z]|[0-9]+|I{1,3}|IV|V)$/i, '').trim();
  return PAIS_CAMPEONATO[base] || '';
}

// Agrupa campeonatos com o mesmo nome base (ex: "Brasileirão A" e "Brasileirão B" → grupo "Brasileirão").
// Detecta sufixo de letra (A, B...), número (2, 3...) ou romano (II, III...) no final do nome.
function gruposCampeonato(camps){
  const SUFIXO = /\s+([A-Z]|[0-9]+|I{1,3}|IV|V)$/i;
  const grupos = {}; // base -> [nomes completos]
  camps.forEach(c=>{
    const m = c.match(SUFIXO);
    const base = m ? c.slice(0, m.index).trim() : c;
    (grupos[base] = grupos[base] || []).push(c);
  });
  return Object.keys(grupos).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'}))
    .map(base => ({ base, itens: sortNatural(grupos[base]) }));
}

// Monta as <option> de uma lista de campeonatos: lista simples e ordenada,
// sem agrupar por liga/optgroup (amistoso e Copa do Mundo ficam por último).
function optionsCampeonato(camps, selecionado){
  const ordenados = comEspeciaisPorUltimo(sortNatural(camps));
  return ordenados.map(c=>`<option value="${c}" ${c===selecionado?'selected':''}>${c}</option>`).join('');
}

// Converte texto digitado no padrão brasileiro (vírgula decimal, ex: "1,10") pra número.
// Necessário porque os campos de Stake/Odd/Retorno usam type="text" (não "number") —
// campos type="number" REJEITAM vírgula em vários teclados Android (só aceitam ponto),
// fazendo o valor "sumir" silenciosamente quando a pessoa digita do jeito brasileiro normal.
function numBR(str){
  if (str === null || str === undefined) return NaN;
  const limpo = String(str).trim().replace(',', '.');
  return limpo === '' ? NaN : parseFloat(limpo);
}

let _toastTimeoutId = null;
function toast(msg, erro=false) {
  const t=document.getElementById('toast');
  if (_toastTimeoutId) { clearTimeout(_toastTimeoutId); _toastTimeoutId = null; } // cancela o timeout anterior, evita um toast antigo escondendo um novo (ou vice-versa)
  t.textContent=msg;
  t.className = erro ? 'show erro' : 'show';
  _toastTimeoutId = setTimeout(()=>{ t.className=''; _toastTimeoutId=null; }, 2400);
}
function toastEsconder() {
  if (_toastTimeoutId) { clearTimeout(_toastTimeoutId); _toastTimeoutId = null; }
  const t=document.getElementById('toast');
  if (t) t.className = '';
}
function poisson(lambda,k) {
  if(lambda<=0) return k===0?1:0;
  let p=Math.exp(-lambda); for(let i=1;i<=k;i++) p*=lambda/i; return p;
}

// Probabilidade de Over numa linha N, para um total combinado com distribuição de Poisson (soma de 2 Poissons = Poisson da soma).
function probOverSingle(lambdaTotal, n){
  let u=0; for(let i=0;i<=40;i++) if(i<=n) u+=poisson(lambdaTotal,i);
  return Math.round((1-u)*100);
}

// Monta a barra visual de confiança (% de jogos com aquele dado realmente preenchido, considerando o pior dos dois times).
// Escala de 5 níveis, pela % de dados coletados:
//  🟢 Excelente (90–100) · 🔵 Bom (75–89) · 🟡 Neutro (55–74) · 🟠 Arriscado (35–54) · 🔴 Evitar (0–34)
function nivelConfianca(pct){
  if(pct>=90) return { emoji:'🟢', nome:'Excelente', cor:'#4dd87a' };
  if(pct>=75) return { emoji:'🔵', nome:'Bom',        cor:'#3a8ee0' };
  if(pct>=55) return { emoji:'🟡', nome:'Neutro',      cor:'var(--ouro)' };
  if(pct>=35) return { emoji:'🟠', nome:'Arriscado',   cor:'#f08060' };
  return          { emoji:'🔴', nome:'Evitar',      cor:'var(--perigo)' };
}
function barraConfianca(pct, casa, vis, confCasa, confVis){
  const nivel = nivelConfianca(pct);
  return `<div class="conf-wrap">
    <div class="conf-label"><span>${nivel.emoji} ${nivel.nome} — dados coletados ${pct}%</span></div>
    <div class="conf-bar"><div class="conf-fill" style="width:${pct}%;background:${nivel.cor}"></div></div>
    <div class="lambda-note" style="margin-top:6px">${casa}: ${confCasa}% dos jogos com dado · ${vis}: ${confVis}% dos jogos com dado</div>
  </div>`;
}
window.nivelConfianca = nivelConfianca;

// Mercados de Cantos e Cartões — total combinado (casa + visitante), baseado nas médias de cada time.
function mercadosCantosCartoes(sC, sV){
  const temCantos  = sC.mediaCantosMarc!=null && sV.mediaCantosMarc!=null;
  const lambdaCantos = temCantos ? r2(sC.mediaCantosMarc + sV.mediaCantosMarc) : null;
  const cantosLinhas = [8.5, 9.5, 10.5];
  // Confiança = o "pior caso" entre os dois times (se um tem pouco dado, a confiança geral cai com ele)
  const confCantos = temCantos ? Math.min(sC.confCantos, sV.confCantos) : 0;

  const cartoesValidos = [sC.mediaAmarProprio, sV.mediaAmarProprio, sC.mediaVermProprio, sV.mediaVermProprio];
  const temCartoes = cartoesValidos.every(v=>v!=null);
  const lambdaCartoes = temCartoes ? r2(cartoesValidos.reduce((a,b)=>a+b,0)) : null;
  const cartoesLinhas = [2.5, 3.5, 4.5];
  const confCartoes = temCartoes ? Math.min(sC.confCartoes, sV.confCartoes) : 0;

  return {
    temCantos, lambdaCantos, confCantos,
    cantos: temCantos ? cantosLinhas.map(n=>({ linha:n, over:probOverSingle(lambdaCantos,Math.floor(n)) })) : [],
    temCartoes, lambdaCartoes, confCartoes,
    cartoes: temCartoes ? cartoesLinhas.map(n=>({ linha:n, over:probOverSingle(lambdaCartoes,Math.floor(n)) })) : [],
  };
}

// Abre o app de e-mail padrão do usuário (Gmail, Outlook, app nativo do celular etc.)
// já com o destinatário e assunto preenchidos — não precisa digitar nada.
function abrirEmail(destino, assunto){
  window.location.href = `mailto:${destino}?subject=${encodeURIComponent(assunto)}`;
}

// Ponte pro mundo React: funções declaradas com "const" não viram propriedade de
// window automaticamente (diferente de "function", que vira). Os componentes React
// (bundle à parte, carregado como <script type="module">) precisam delas via window.
window.fd = fd;
window.res = res;
window.r2 = r2;
window.sortNatural = sortNatural;

