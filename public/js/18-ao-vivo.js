// ═══════════════════════════════════════════════════
// CARD "AO VIVO" — topo do Dashboard. Mostra os jogos de hoje que já
// começaram (placar e minuto), alimentados pelo webhook da GOAL API
// (netlify/functions/goal-webhook.js escreve na tabela "jogos_ao_vivo").
//
// Só LEITURA aqui — quem escreve é sempre a função serverless via webhook.
// Por isso não gasta cota nenhuma da GOAL API: é só uma leitura barata no
// Supabase, igual a qualquer outra tabela do app.
//
// Some sozinho da tela 3h depois de marcado como "encerrado" (dá tempo de
// quem abriu o app logo depois do apito final ainda ver o resultado).
// ═══════════════════════════════════════════════════
let avCache = [];

async function avCarregarNuvem() {
  if (typeof temConfig !== 'function' || !temConfig()) return;
  try {
    const res = await fetch(sbUrlAoVivo('?order=status.desc,horario.asc'), { headers: sbHeaders() });
    if (!res.ok) return;
    avCache = await res.json();
  } catch { /* falha silenciosa — tenta de novo no próximo ciclo */ }
}

function avVisivel(j) {
  if (j.status !== 'encerrado') return true; // ao_vivo/agendado sempre aparece
  if (!j.atualizado_em) return true;
  const limite = new Date(j.atualizado_em).getTime() + 3 * 60 * 60 * 1000; // 3h após marcado como encerrado
  return Date.now() < limite;
}

function avRotuloMinuto(j) {
  if (j.status === 'encerrado') return 'Encerrado';
  if (!j.minuto) return j.horario ? `Início ${j.horario}` : 'Ao vivo';
  const m = String(j.minuto);
  return /^(ht|ft)$/i.test(m) ? m.toUpperCase() : `${m}'`;
}

function avRenderLista() {
  const cardEl = document.getElementById('aoVivoCardDash');
  const listaEl = document.getElementById('aoVivoLista');
  if (!cardEl || !listaEl) return;

  const lista = avCache.filter(avVisivel);
  if (!lista.length) { cardEl.style.display = 'none'; return; }
  cardEl.style.display = 'block';

  listaEl.innerHTML = lista.map((j) => `
    <div style="flex:0 0 auto;width:150px;background:var(--c2);border:2px solid ${j.status === 'ao_vivo' ? 'var(--vermelho, #e5484d)' : 'var(--c3)'};border-radius:10px;padding:10px;text-align:center;position:relative">
      ${j.status === 'ao_vivo' ? '<div style="position:absolute;top:6px;left:6px;width:7px;height:7px;border-radius:50%;background:var(--vermelho, #e5484d)"></div>' : ''}
      <div style="font-size:9px;color:var(--ouro);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:center;gap:3px;margin-bottom:6px"><span data-ic="trophy" data-ic-size="10"></span> ${j.camp || '—'}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
        <div style="flex:1;min-width:0">
          <div style="width:26px;height:26px;margin:0 auto">${escudoImgOuIcone(j.casa)}</div>
          <div style="font-size:9.5px;font-weight:700;line-height:1.2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${j.casa || '—'}</div>
        </div>
        <div style="font-size:15px;font-weight:900;color:var(--texto);flex-shrink:0">${j.gc ?? 0}-${j.gv ?? 0}</div>
        <div style="flex:1;min-width:0">
          <div style="width:26px;height:26px;margin:0 auto">${escudoImgOuIcone(j.vis)}</div>
          <div style="font-size:9.5px;font-weight:700;line-height:1.2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${j.vis || '—'}</div>
        </div>
      </div>
      <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--c3);font-size:9px;font-weight:700;color:${j.status === 'ao_vivo' ? 'var(--vermelho, #e5484d)' : 'var(--texto2)'}">${avRotuloMinuto(j)}</div>
    </div>`).join('');
  window.renderIcons?.(listaEl);
}
window.avCarregarNuvem = avCarregarNuvem;
window.avRenderLista = avRenderLista;

avCarregarNuvem().then(avRenderLista);
setInterval(async () => { await avCarregarNuvem(); avRenderLista(); }, 30000); // 30s — é só leitura, não gasta cota da GOAL API
