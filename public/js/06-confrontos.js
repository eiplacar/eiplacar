// ═══════════════════════════════════════════════════
// CADASTRAR JOGO (H2H) — gols por minuto, salvar/deletar jogo
// ═══════════════════════════════════════════════════

async function salvarJogo() {
  if (!temConfig()) { toast('⚠️ Sem conexão com o banco de dados', true); return; }
  const camp=document.getElementById('iCamp').value.trim();
  const casa=document.getElementById('iCasa').value.trim();
  const vis=document.getElementById('iVis').value.trim();
  const data=document.getElementById('iData').value;
  const rodada=document.getElementById('iRodada').value.trim();

  // Validações obrigatórias
  if(!camp)   { toast('⚠️ Informe o campeonato!'); document.getElementById('iCamp').focus(); return; }
  if(!data)   { toast('⚠️ Informe a data do jogo!'); document.getElementById('iData').focus(); return; }
  if(!casa)   { toast('⚠️ Informe o time mandante!'); document.getElementById('iCasa').focus(); return; }
  if(!vis)    { toast('⚠️ Informe o time visitante!'); document.getElementById('iVis').focus(); return; }
  if(!rodada) { toast('⚠️ Informe a rodada/fase!'); document.getElementById('iRodada').focus(); return; }
  if(casa===vis){ toast('⚠️ Mandante e visitante não podem ser o mesmo time!'); return; }

  // Verificar duplicado
  const dup=jogosCache.find(j=>j.camp===camp&&j.casa===casa&&j.vis===vis&&j.data===data);
  if(dup){ toast('⚠️ Este jogo já está registrado nessa data!'); return; }

  const jogo = {
    camp, data:document.getElementById('iData').value,
    rodada:document.getElementById('iRodada').value.trim(),
    local:document.getElementById('iLocal').value.trim(),
    casa, vis,
    gC:parseInt(document.getElementById('iGC').value)||0,
    gV:parseInt(document.getElementById('iGV').value)||0,
    rankC:parseInt(document.getElementById('iRC').value)||null,
    rankV:parseInt(document.getElementById('iRV').value)||null,
    gols:[...golsTemp],
    // Dados avançados (opcionais — ficam null se não preenchidos)
    golsHT_C:campoIntOuNull('iHTC'), golsHT_V:campoIntOuNull('iHTV'),
    chutesC:campoIntOuNull('iChutesC'), chutesV:campoIntOuNull('iChutesV'),
    chutesGolC:campoIntOuNull('iChutesGolC'), chutesGolV:campoIntOuNull('iChutesGolV'),
    escanteiosC:campoIntOuNull('iEscanteiosC'), escanteiosV:campoIntOuNull('iEscanteiosV'),
    amarelosC:campoIntOuNull('iAmarelosC'), amarelosV:campoIntOuNull('iAmarelosV'),
    vermelhosC:campoIntOuNull('iVermelhosC'), vermelhosV:campoIntOuNull('iVermelhosV'),
  };

  const salvo = await inserirJogo(jogo);
  if (!salvo) return;

  jogosCache.unshift({ ...salvo, gols: salvo.gols || [] });
  ['iCamp','iRodada','iLocal','iCasa','iVis','iRC','iRV','iHTC','iHTV','iChutesC','iChutesV','iChutesGolC','iChutesGolV','iEscanteiosC','iEscanteiosV','iAmarelosC','iAmarelosV','iVermelhosC','iVermelhosV'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('iGC').value=0; document.getElementById('iGV').value=0;
  golsTemp=[]; syncNomes(); renderCampo(); renderGolsLista();
  sugCamp(); onCampInput(); atualizarHeader(); renderGeral();
  toast('✅ Jogo salvo na nuvem! ☁️');
}

// Lê um campo numérico do formulário; retorna null se vazio (em vez de 0),
// para diferenciar "não informado" de "valor zero" nos dados avançados.
function campoIntOuNull(id){
  const el = document.getElementById(id);
  if(!el || el.value==='' || el.value==null) return null;
  const n = parseInt(el.value);
  return isNaN(n) ? null : n;
}

// ══ DELETAR ══
async function deletarJogo(id) {
  if(!confirm('Remover este jogo?')) return;
  const ok = await deletarJogoNuvem(id);
  if (!ok) return;
  jogosCache = jogosCache.filter(j=>j.id!==id);
  renderDados(); atualizarHeader(); renderGeral();
  toast('🗑️ Removido');
}

