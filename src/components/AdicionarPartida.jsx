import { useEffect } from 'react';
import { Shield, Timer, Target, Flag, Square, Trophy, Swords, Award, CircleDot, Save, AlertTriangle } from 'lucide-react';

// ══ Adicionar Partida (aba Partidas) — quarto módulo migrado para React ══
//
// Este formulário tem bastante coisa entrelaçada com o resto do app: upload de
// escudo (com redimensionamento via canvas), a lista de "gols por minuto", alerta
// de time/jogo duplicado, sugestões (datalist) que dependem do jogosCache, e o
// salvamento em si (Supabase + jogosCache + atualização de outras abas).
//
// Pra não arriscar essa parte tão conectada, a migração aqui foi de organização:
// o HTML virou este componente React (mais fácil de manter e ler), mas os campos
// continuam "não controlados" (o valor mora no DOM, como sempre foi) e todo o
// comportamento continua chamando as MESMAS funções JS puras de sempre
// (window.salvarJogo, window.syncNomes, window.addGol, window.escudoInput...),
// com os MESMOS ids. Nada nessas funções precisou mudar.
//
// Layout: nome dos times aparece uma vez só (linha do confronto), e os escudos se
// repetem como referência visual nas seções de estatística (mini-escudos, classe
// escudo-mini-casa/vis — window.syncNomes() sincroniza todos eles de uma vez).

function StatSection({ icon: Icon, title, children }) {
  return (
    <>
      <div style={{ height: 1, background: 'var(--c3)', margin: '14px 0' }} />
      <div className="adv-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={13} /> {title}</div>
      {children}
    </>
  );
}

function StatRow({ idCasa, idVis, placeholderCasa, placeholderVis }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="escudo-mini escudo-mini-casa"><Shield size={13} /></div>
        <input type="number" id={idCasa} min="0" placeholder={placeholderCasa} style={{ flex: 1, minWidth: 0 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="escudo-mini escudo-mini-vis"><Shield size={13} /></div>
        <input type="number" id={idVis} min="0" placeholder={placeholderVis} style={{ flex: 1, minWidth: 0 }} />
      </div>
    </div>
  );
}

export default function AdicionarPartida() {
  useEffect(() => {
    const iData = document.getElementById('iData');
    if (iData && !iData.value) iData.value = new Date().toISOString().split('T')[0];
  }, []);

  return (
    <div className="card">
      {/* O título "Adicionar Partida" já aparece na sub-aba logo acima — não precisa repetir aqui dentro */}

      {/* Campeonato */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Campeonato <span style={{ color: 'var(--perigo)' }}>*</span></label>
        <input type="text" id="iCamp" placeholder="Ex: Brasileirão" list="campSug" onInput={() => window.onCampInput?.()} />
        <datalist id="campSug"></datalist>
      </div>

      {/* Confronto — nome dos times + escudo aparece só aqui */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><Swords size={13} /> Confronto <span style={{ color: 'var(--perigo)' }}>*</span></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div className="escudo-upload" id="escudoCasa" onClick={() => window.escudoInput?.('iCasa')} title="Toque para adicionar o escudo" style={{ width: 40, height: 40, margin: 0, fontSize: 16 }}><Shield size={17} /></div>
          <input type="text" id="iCasa" placeholder="Mandante" list="timesSug" style={{ flex: 1, minWidth: 0 }} onInput={() => { window.syncNomes?.(); window.onTimeInput?.(); }} />
        </div>
        <Swords size={14} style={{ color: 'var(--texto2)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <input type="text" id="iVis" placeholder="Visitante" list="timesSug" style={{ flex: 1, minWidth: 0 }} onInput={() => { window.syncNomes?.(); window.onTimeInput?.(); }} />
          <div className="escudo-upload" id="escudoVis" onClick={() => window.escudoInput?.('iVis')} title="Toque para adicionar o escudo" style={{ width: 40, height: 40, margin: 0, fontSize: 16 }}><Shield size={17} /></div>
        </div>
      </div>
      {/* Compat: syncNomes() ainda escreve nome aqui, mas fica escondido — o nome já aparece nos inputs acima */}
      <div style={{ display: 'none' }}><span id="pNomeCasa">Mandante</span><span id="pNomeVis">Visitante</span></div>
      <datalist id="timesSug"></datalist>

      {/* Alerta time duplicado */}
      <div id="alertaDupTime" style={{ display: 'none', alignItems: 'center', gap: 6, background: 'rgba(224,92,58,.15)', border: '1px solid var(--perigo)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--perigo)', marginBottom: 10 }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} /> Mandante e Visitante não podem ser o mesmo time!
      </div>
      {/* Alerta jogo duplicado */}
      <div id="alertaDupJogo" style={{ display: 'none', alignItems: 'center', gap: 6, background: 'rgba(245,197,24,.12)', border: '1px solid var(--ouro)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--ouro)', marginBottom: 10 }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} /> Este jogo já foi registrado nesta data!
      </div>

      {/* Placar — só os números, nome/escudo já apareceram acima */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <input type="number" id="iGC" min="0" defaultValue="0" style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, padding: 6, width: 56, flexShrink: 0 }} />
        <div className="vs-label">×</div>
        <input type="number" id="iGV" min="0" defaultValue="0" style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, padding: 6, width: 56, flexShrink: 0 }} />
      </div>
      <input type="file" id="escudoFileInput" accept="image/*" style={{ display: 'none' }} onChange={(e) => window.onEscudoFileChange?.(e)} />

      {/* Data + Rodada + Local — resumo da partida, tudo junto */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
        <div>
          <label style={{ fontSize: 10 }}>Data <span style={{ color: 'var(--perigo)' }}>*</span></label>
          <input type="date" id="iData" style={{ padding: '8px 4px', fontSize: 11 }} />
        </div>
        <div>
          <label style={{ fontSize: 10 }}>Rodada <span style={{ color: 'var(--perigo)' }}>*</span></label>
          <input type="text" id="iRodada" placeholder="Ex: 10" list="rodadasSug" style={{ padding: '8px 4px', fontSize: 11 }} />
          <datalist id="rodadasSug"></datalist>
        </div>
        <div>
          <label style={{ fontSize: 10 }}>Local</label>
          <input type="text" id="iLocal" placeholder="—" list="localSug" style={{ padding: '8px 4px', fontSize: 11 }} />
          <datalist id="localSug"></datalist>
        </div>
      </div>

      {/* Ranking */}
      <StatSection icon={Award} title="Ranking">
        <StatRow idCasa="iRC" idVis="iRV" placeholderCasa="Ex: 1" placeholderVis="Ex: 9" />
      </StatSection>

      {/* Gols por Tempo */}
      <StatSection icon={Timer} title="Gols por Tempo (1º Tempo)">
        <StatRow idCasa="iHTC" idVis="iHTV" placeholderCasa="Ex: 2" placeholderVis="Ex: 0" />
      </StatSection>

      {/* Chutes */}
      <StatSection icon={Target} title="Chutes">
        <StatRow idCasa="iChutesC" idVis="iChutesV" placeholderCasa="Ex: 14" placeholderVis="Ex: 8" />
      </StatSection>

      {/* Chutes no Gol */}
      <StatSection icon={CircleDot} title="Chutes no Gol">
        <StatRow idCasa="iChutesGolC" idVis="iChutesGolV" placeholderCasa="Ex: 6" placeholderVis="Ex: 3" />
      </StatSection>

      {/* Escanteios */}
      <StatSection icon={Flag} title="Escanteios">
        <StatRow idCasa="iEscanteiosC" idVis="iEscanteiosV" placeholderCasa="Ex: 6" placeholderVis="Ex: 4" />
      </StatSection>

      {/* Amarelos */}
      <StatSection icon={() => <Square size={12} fill="var(--ouro)" color="var(--ouro)" />} title="Amarelos">
        <StatRow idCasa="iAmarelosC" idVis="iAmarelosV" placeholderCasa="Ex: 2" placeholderVis="Ex: 3" />
      </StatSection>

      {/* Vermelhos */}
      <StatSection icon={() => <Square size={12} fill="var(--perigo)" color="var(--perigo)" />} title="Vermelhos">
        <StatRow idCasa="iVermelhosC" idVis="iVermelhosV" placeholderCasa="Ex: 0" placeholderVis="Ex: 0" />
      </StatSection>

      <div style={{ height: 1, background: 'var(--c3)', margin: '14px 0' }} />

      {/* Gols por minuto — continua no final, pra registrar a cronologia da partida */}
      <div className="timeline-box">
        <div className="tl-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Timer size={14} /> Gols por Minuto</div>
        <div className="gol-form">
          <div style={{ maxWidth: 90 }}><label>Minuto</label><input type="number" id="golMin" min="1" max="120" placeholder="45" /></div>
          <div style={{ flex: 1 }}>
            <label>Quem marcou?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-time casa-btn" id="btnCasa" onClick={() => window.addGol?.('casa')}>Mandante</button>
              <button className="btn-time vis-btn" id="btnVis" onClick={() => window.addGol?.('vis')}>Visitante</button>
            </div>
          </div>
        </div>
        <div className="campo" id="campoVisual"></div>
        <div className="legenda">
          <div className="legenda-item"><div className="dot dot-c"></div><span id="legCasa">Mandante</span></div>
          <div className="legenda-item"><div className="dot dot-v"></div><span id="legVis">Visitante</span></div>
          <div style={{ flex: 1 }}></div>
          <span id="contGols" style={{ fontSize: 11, color: 'var(--texto2)' }}>0 gols</span>
        </div>
        <div className="gols-lista" id="golsLista"></div>
      </div>

      <button className="btn-primary" onClick={() => window.salvarJogo?.()} style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Save size={15} /> Salvar Partida
      </button>
    </div>
  );
}
