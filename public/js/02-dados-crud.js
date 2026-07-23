// ═══════════════════════════════════════════════════
// DADOS: CRUD DE JOGOS — leitura/escrita de jogos na nuvem, editar jogo
// (o modal de configuração do Supabase foi removido da UI — credenciais fixas
// em 01-config-auth.js; setup documentado em SUPABASE_SETUP.md)
// ═══════════════════════════════════════════════════
// ══ MODAL MENU EXPLICAÇÃO BANCA ══
function abrirMenuBanca() { document.getElementById('modalMenuBanca').classList.add('open'); }
function fecharMenuBanca() { document.getElementById('modalMenuBanca').classList.remove('open'); }

// ══ CRUD via fetch REST ══
async function carregarJogos() {
  if (!temConfig()) {
    setSyncStatus('config', 'Sem conexão com o banco de dados');
    jogosCache = []; renderAll(); return;
  }
  setSyncStatus('sync', 'Carregando...');
  try {
    const PAGE_SIZE = 1000;
    let todos = [];
    let from = 0;
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const res = await fetch(sbUrl('?order=created_at.desc'), {
        headers: { ...sbHeaders(), 'Range-Unit': 'items', 'Range': `${from}-${to}` }
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t); }
      const data = await res.json();
      todos = todos.concat(data);
      if (data.length < PAGE_SIZE) break; // última página
      from += PAGE_SIZE;
    }
    jogosCache = todos.map(j => ({ ...j, gols: j.gols || [] }));
    setSyncStatus('ok', `☁️ ${jogosCache.length} jogo(s) sincronizado(s)`);
    atualizarHeader(); renderAll(); sugCamp();
  } catch(e) {
    setSyncStatus('erro', 'Erro: ' + e.message);
    toast('❌ Erro ao carregar: ' + e.message, true);
  }
}

async function inserirJogo(jogo) {
  if (!temConfig()) { toast('⚠️ Sem conexão com o banco de dados', true); return false; }
  setSyncStatus('sync', 'Salvando...');
  try {
    const { id, ...dados } = jogo; // remove id local
    const res = await fetch(sbUrl(), {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify(dados)
    });
    if (!res.ok) { const t = await res.text(); throw new Error(t); }
    const data = await res.json();
    setSyncStatus('ok', '☁️ Salvo na nuvem!');
    return Array.isArray(data) ? data[0] : data;
  } catch(e) {
    setSyncStatus('erro', 'Erro ao salvar: ' + e.message);
    toast('❌ Erro ao salvar: ' + e.message, true);
    return false;
  }
}

async function deletarJogoNuvem(id) {
  if (!temConfig()) return false;
  setSyncStatus('sync', 'Removendo...');
  try {
    const res = await fetch(sbUrl(`?id=eq.${id}`), {
      method: 'DELETE',
      headers: sbHeaders()
    });
    if (!res.ok) { const t = await res.text(); throw new Error(t); }
    setSyncStatus('ok', '☁️ Removido da nuvem');
    return true;
  } catch(e) {
    setSyncStatus('erro', 'Erro ao remover: ' + e.message);
    return false;
  }
}

async function atualizarJogoNuvem(id, dados) {
  if (!temConfig()) { toast('⚠️ Sem conexão com o banco de dados', true); return false; }
  setSyncStatus('sync', 'Atualizando...');
  try {
    const res = await fetch(sbUrl(`?id=eq.${id}`), {
      method: 'PATCH',
      headers: { ...sbHeaders(), 'Prefer': 'return=representation' },
      body: JSON.stringify(dados)
    });
    if (!res.ok) { const t = await res.text(); throw new Error(t); }
    const data = await res.json();
    setSyncStatus('ok', '☁️ Atualizado na nuvem!');
    return Array.isArray(data) ? data[0] : data;
  } catch(e) {
    setSyncStatus('erro', 'Erro ao atualizar: ' + e.message);
    toast('❌ Erro ao atualizar: ' + e.message, true);
    return false;
  }
}

// ══ EDITAR JOGO (modal) ══
let jogoEditandoId = null;

function abrirEditarJogo(id){
  const j = jogosCache.find(x=>x.id===id);
  if(!j){ toast('⚠️ Jogo não encontrado'); return; }
  jogoEditandoId = id;
  document.getElementById('eCamp').value   = j.camp || '';
  document.getElementById('eData').value   = j.data || '';
  document.getElementById('eRodada').value = j.rodada || '';
  document.getElementById('eLocal').value  = j.local || '';
  document.getElementById('eCasa').value   = j.casa || '';
  document.getElementById('eVis').value    = j.vis || '';
  syncNomesEdicao();
  document.getElementById('eGC').value     = j.gC ?? 0;
  document.getElementById('eGV').value     = j.gV ?? 0;
  document.getElementById('eRC').value     = j.rankC ?? '';
  document.getElementById('eRV').value     = j.rankV ?? '';
  document.getElementById('eHTC').value         = j.golsHT_C ?? '';
  document.getElementById('eHTV').value         = j.golsHT_V ?? '';
  document.getElementById('eChutesC').value     = j.chutesC ?? '';
  document.getElementById('eChutesV').value     = j.chutesV ?? '';
  document.getElementById('eChutesGolC').value  = j.chutesGolC ?? '';
  document.getElementById('eChutesGolV').value  = j.chutesGolV ?? '';
  document.getElementById('eEscanteiosC').value = j.escanteiosC ?? '';
  document.getElementById('eEscanteiosV').value = j.escanteiosV ?? '';
  document.getElementById('eAmarelosC').value   = j.amarelosC ?? '';
  document.getElementById('eAmarelosV').value   = j.amarelosV ?? '';
  document.getElementById('eVermelhosC').value  = j.vermelhosC ?? '';
  document.getElementById('eVermelhosV').value  = j.vermelhosV ?? '';
  document.getElementById('modalEditarJogo').classList.add('open');
}

function fecharModalEditar(){
  document.getElementById('modalEditarJogo').classList.remove('open');
  jogoEditandoId = null;
}

function campoIntOuNullEdit(id){
  const el = document.getElementById(id);
  if(!el || el.value==='' || el.value==null) return null;
  const n = parseInt(el.value);
  return isNaN(n) ? null : n;
}

async function confirmarEdicaoJogo(){
  if(jogoEditandoId==null) return;
  const camp   = document.getElementById('eCamp').value.trim();
  const data   = document.getElementById('eData').value;
  const rodada = document.getElementById('eRodada').value.trim();
  const casa   = document.getElementById('eCasa').value.trim();
  const vis    = document.getElementById('eVis').value.trim();

  if(!camp){ toast('⚠️ Informe o campeonato!'); return; }
  if(!data){ toast('⚠️ Informe a data!'); return; }
  if(!casa || !vis){ toast('⚠️ Informe os dois times!'); return; }
  if(casa===vis){ toast('⚠️ Mandante e visitante não podem ser o mesmo time!'); return; }

  const dados = {
    camp, data, rodada,
    local: document.getElementById('eLocal').value.trim(),
    casa, vis,
    gC: parseInt(document.getElementById('eGC').value)||0,
    gV: parseInt(document.getElementById('eGV').value)||0,
    rankC: campoIntOuNullEdit('eRC'), rankV: campoIntOuNullEdit('eRV'),
    golsHT_C: campoIntOuNullEdit('eHTC'), golsHT_V: campoIntOuNullEdit('eHTV'),
    chutesC: campoIntOuNullEdit('eChutesC'), chutesV: campoIntOuNullEdit('eChutesV'),
    chutesGolC: campoIntOuNullEdit('eChutesGolC'), chutesGolV: campoIntOuNullEdit('eChutesGolV'),
    escanteiosC: campoIntOuNullEdit('eEscanteiosC'), escanteiosV: campoIntOuNullEdit('eEscanteiosV'),
    amarelosC: campoIntOuNullEdit('eAmarelosC'), amarelosV: campoIntOuNullEdit('eAmarelosV'),
    vermelhosC: campoIntOuNullEdit('eVermelhosC'), vermelhosV: campoIntOuNullEdit('eVermelhosV'),
  };

  const atualizado = await atualizarJogoNuvem(jogoEditandoId, dados);
  if(!atualizado) return;

  const idx = jogosCache.findIndex(j=>j.id===jogoEditandoId);
  if(idx>-1) jogosCache[idx] = { ...jogosCache[idx], ...atualizado, gols: atualizado.gols || jogosCache[idx].gols || [] };

  fecharModalEditar();
  renderDados(); atualizarHeader(); renderGeral(); sugCamp();
  toast('✅ Jogo atualizado! ☁️');
}

// ══ ESTADO LOCAL (gols temporários) ══
let golsTemp = [];
const filtro = { casa: { local: 'all', qty: 0 }, vis: { local: 'all', qty: 0 } };
window.filtro = filtro; // ponte pro componente React da Análise (mesmo objeto, não uma cópia)

const periodos6 = [
  { l:'1–15',   s:1,  e:15  },{ l:'16–30',  s:16, e:30  },{ l:'31–45+', s:31, e:45  },
  { l:'46–60',  s:46, e:60  },{ l:'61–75',  s:61, e:75  },{ l:'76–90+', s:76, e:120 },
];
const periodos4 = [
  { l:"1-20'",   ico:'🌅', s:1,  e:20  },{ l:"21-45+'", ico:'⚡', s:21, e:45  },
  { l:"46-65'",  ico:'🔥', s:46, e:65  },{ l:"66-90+'", ico:'🏁', s:66, e:120 },
];

