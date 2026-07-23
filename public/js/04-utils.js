// ═══════════════════════════════════════════════════
// UTILITÁRIOS — formatação de data, ordenação, matemática de probabilidade (Poisson), toast
// ═══════════════════════════════════════════════════
// ══ HELPERS ══
const fd  = s => { if(!s) return '—'; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; };
const res = (gC,gV) => gC>gV?'<span class="badge-result badge-v">V</span>':gC===gV?'<span class="badge-result badge-e">E</span>':'<span class="badge-result badge-d">D</span>';
const r2  = n => Math.round(n*100)/100;
// Ordenação natural: "Bundesliga" vem antes de "Bundesliga 2", e "Bundesliga 2" antes de "Bundesliga 10"
// (ordenação alfabética pura colocaria "Bundesliga 10" antes de "Bundesliga 2").
const sortNatural = arr => [...arr].sort((a,b)=>a.localeCompare(b, 'pt-BR', { numeric:true, sensitivity:'base' }));

// Amistoso(s) e Copa do Mundo não são ligas de verdade — sempre ficam por último nas listas de campeonato.
function comEspeciaisPorUltimo(camps){
  const especiais = camps.filter(c=>/amistoso|copa do mundo/i.test(c)).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const normais   = camps.filter(c=>!/amistoso|copa do mundo/i.test(c));
  return [...normais, ...especiais];
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

// Monta as <option>/<optgroup> de uma lista de campeonatos, agrupando quando há mais de uma variante do mesmo nome base.
// Ligas sem variante (só 1 com aquele nome) ficam juntas no grupo "Outras Ligas", ao final.
function optionsCampeonato(camps, selecionado){
  const grupos = gruposCampeonato(camps);
  const comVariante = grupos.filter(g=>g.itens.length>=2);
  const soltas = grupos.filter(g=>g.itens.length<2).flatMap(g=>g.itens);

  let html = comVariante.map(g=>
    `<optgroup label="${g.base}">${g.itens.map(c=>`<option value="${c}" ${c===selecionado?'selected':''}>${c}</option>`).join('')}</optgroup>`
  ).join('');

  if(soltas.length){
    html += `<optgroup label="Outras Ligas">${sortNatural(soltas).map(c=>`<option value="${c}" ${c===selecionado?'selected':''}>${c}</option>`).join('')}</optgroup>`;
  }
  return html;
}

function toast(msg, erro=false) {
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className = erro ? 'show erro' : 'show';
  setTimeout(()=>t.className='',2400);
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

// Ponte pro mundo React: funções declaradas com "const" não viram propriedade de
// window automaticamente (diferente de "function", que vira). Os componentes React
// (bundle à parte, carregado como <script type="module">) precisam delas via window.
window.fd = fd;
window.res = res;
window.r2 = r2;
window.sortNatural = sortNatural;

