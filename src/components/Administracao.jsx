import { useEffect, useState } from 'react';
import {
  Users, CreditCard, Settings, Search, ArrowLeft, CheckCircle2, XCircle,
  RefreshCw, Ban, Trash2, ShieldCheck, Save, Circle,
} from 'lucide-react';

// ══ Administração — Usuários / Assinaturas / Sistema ══
//
// "Usuários" e "Assinaturas" mostram a mesma lista (tabela "perfis" do Supabase),
// só que uma foca em gerenciar a pessoa (bloquear/excluir/editar) e a outra foca
// no plano dela (aprovar/renovar/trocar). Como não existe gateway de pagamento
// integrado, "aprovar"/"renovar" um plano aqui é o organizador confirmando
// manualmente que recebeu o pagamento por fora (Pix, dinheiro etc).
//
// Pontes com o JS puro (public/js/16-admin.js e 01-config-auth.js):
//   - window.adminListarUsuarios() / adminAtualizarUsuario / adminExcluirUsuario
//   - window.adminAprovarPlano / adminRenovarPlano / adminCancelarAssinatura / adminBloquearUsuario
//   - window.aprovarMembro(id) / rejeitarMembro(id) → aprovação de acesso (pendente → aprovado)
//   - window.cfgAppLoad() / cfgAppSave(d) → preço dos planos e dias de teste

const PLANOS_BASE = [
  { id: 'mensal', nome: 'Mensal', dias: 30 },
  { id: 'trimestral', nome: 'Trimestral', dias: 90 },
  { id: 'semestral', nome: 'Semestral', dias: 180 },
];

function fdBr(s) { return s && window.fd ? window.fd(s) : (s || '—'); }
function diasRestantes(vencimento) {
  if (!vencimento) return null;
  return Math.ceil((new Date(vencimento + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
}
function statusUsuario(u) {
  if (u.status === 'pendente') return { cor: '#e0b23c', texto: 'Pendente de aprovação' };
  if (u.status === 'rejeitado') return { cor: '#8a8a8a', texto: 'Cadastro rejeitado' };
  if (u.bloqueado) return { cor: '#8a8a8a', texto: 'Bloqueado' };
  const dias = diasRestantes(u.assinatura_vencimento);
  const nomePlano = u.plano ? (PLANOS_BASE.find((p) => p.id === u.plano)?.nome || u.plano) : 'Teste';
  if (u.assinatura_status === 'cancelado') return { cor: '#f08060', texto: `Plano: Cancelado` };
  if (dias == null) return { cor: '#4dd87a', texto: `Plano: ${nomePlano}` };
  if (dias < 0) return { cor: '#f08060', texto: `Plano: Expirado`, linha: `Venceu: ${fdBr(u.assinatura_vencimento)}` };
  const linha = (!u.plano || u.plano === '') ? `Restam: ${dias} dias` : `Vence: ${fdBr(u.assinatura_vencimento)}`;
  return { cor: '#4dd87a', texto: `Plano: ${nomePlano}`, linha };
}
function StatusDot({ cor, size = 10 }) {
  return <Circle size={size} fill={cor} color={cor} style={{ flexShrink: 0 }} />;
}

function useUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [colunasFaltando, setColunasFaltando] = useState(false);
  async function recarregar() {
    setCarregando(true);
    const r = await window.adminListarUsuarios();
    setUsuarios(r.usuarios || []);
    setColunasFaltando(!!r.colunasFaltando);
    setCarregando(false);
  }
  useEffect(() => {
    recarregar();
    window.administracaoRefresh = recarregar;
    return () => { delete window.administracaoRefresh; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { usuarios, carregando, colunasFaltando, recarregar };
}

function PlanoPicker({ titulo, onEscolher, onCancelar }) {
  return (
    <div style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: 12, marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PLANOS_BASE.map((p) => (
          <button key={p.id} onClick={() => onEscolher(p)} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 6, padding: '8px 10px', color: 'var(--texto)', cursor: 'pointer' }}>
            <span>{p.nome}</span><span style={{ color: 'var(--texto2)' }}>{p.dias} dias</span>
          </button>
        ))}
      </div>
      <button onClick={onCancelar} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--texto2)', fontSize: 11.5, cursor: 'pointer' }}>Cancelar</button>
    </div>
  );
}

function UsuarioDetalhe({ usuario, onVoltar, onMudou }) {
  const [u, setU] = useState(usuario);
  const [picker, setPicker] = useState(null); // 'aprovar' | 'renovar' | null
  const [salvando, setSalvando] = useState(false);
  const st = statusUsuario(u);

  async function salvarEdicao() {
    setSalvando(true);
    const r = await window.adminAtualizarUsuario(u.id, { nome: u.nome, telefone: u.telefone });
    setSalvando(false);
    if (!r.ok) { window.toast?.('⚠️ Não foi possível salvar (talvez falte a coluna "telefone")', true); return; }
    window.toast?.('✅ Dados atualizados'); onMudou();
  }
  async function aprovarAcesso() { await window.aprovarMembro(u.id); window.toast?.('✅ Acesso aprovado'); onMudou(); onVoltar(); }
  async function rejeitarAcesso() { if (!confirm('Rejeitar o cadastro de ' + u.nome + '?')) return; await window.rejeitarMembro(u.id); onMudou(); onVoltar(); }
  async function escolherPlano(p) {
    const r = picker === 'aprovar' ? await window.adminAprovarPlano(u.id, p.id, p.dias) : await window.adminRenovarPlano(u.id, u.assinatura_vencimento, p.dias);
    setPicker(null);
    if (!r.ok) { window.toast?.('⚠️ ' + (r.msg || 'Erro ao salvar plano'), true); return; }
    window.toast?.('✅ Plano atualizado'); onMudou();
    const atualizado = await window.adminListarUsuarios();
    setU((atualizado.usuarios || []).find((x) => x.id === u.id) || u);
  }
  async function cancelar() {
    if (!confirm('Cancelar a assinatura de ' + u.nome + '?')) return;
    const r = await window.adminCancelarAssinatura(u.id);
    if (!r.ok) { window.toast?.('⚠️ Erro ao cancelar', true); return; }
    window.toast?.('✅ Assinatura cancelada'); onMudou(); onVoltar();
  }
  async function bloquear() {
    const r = await window.adminBloquearUsuario(u.id, !u.bloqueado);
    if (!r.ok) { window.toast?.('⚠️ Não foi possível bloquear (talvez falte a coluna "bloqueado")', true); return; }
    setU((x) => ({ ...x, bloqueado: !x.bloqueado }));
    window.toast?.(u.bloqueado ? '✅ Usuário desbloqueado' : '🚫 Usuário bloqueado'); onMudou();
  }
  async function excluir() {
    if (!confirm(`Excluir o acesso de ${u.nome}? Isso remove o perfil dele do app (não apaga a conta de login).`)) return;
    const r = await window.adminExcluirUsuario(u.id);
    if (!r.ok) { window.toast?.('⚠️ Erro ao excluir', true); return; }
    window.toast?.('🗑️ Usuário removido'); onMudou(); onVoltar();
  }

  return (
    <>
      <button onClick={onVoltar} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--texto2)', fontSize: 12.5, cursor: 'pointer', marginBottom: 10 }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusDot cor={st.cor} /> {u.nome}</div>
        <div className="fg">
          <div><label>Nome</label><input type="text" value={u.nome || ''} onChange={(e) => setU((x) => ({ ...x, nome: e.target.value }))} /></div>
        </div>
        <div className="fg fg2">
          <div><label>Telefone</label><input type="tel" value={u.telefone || ''} onChange={(e) => setU((x) => ({ ...x, telefone: e.target.value }))} /></div>
          <div><label>Data de Nascimento</label><input type="text" value={fdBr(u.data_nascimento)} disabled style={{ opacity: .6 }} /></div>
        </div>
        <div className="fg fg2">
          <div><label>E-mail</label><input type="text" value={u.email || '—'} disabled style={{ opacity: .6 }} /></div>
          <div><label>Cadastro</label><input type="text" value={fdBr(u.created_at && u.created_at.slice(0, 10))} disabled style={{ opacity: .6 }} /></div>
        </div>
        <button className="btn-primary" onClick={salvarEdicao} disabled={salvando}>{salvando ? 'Salvando...' : '💾 Salvar dados'}</button>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CreditCard size={14} /> Plano</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>Status</span><strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><StatusDot cor={st.cor} size={9} /> {st.texto}</strong></div>
          {st.linha && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>{st.linha.split(':')[0]}</span><strong>{st.linha.split(': ')[1]}</strong></div>}
        </div>

        {u.status === 'pendente' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={aprovarAcesso}><CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Aprovar Acesso</button>
            <button onClick={rejeitarAcesso} className="btn-danger" style={{ flex: 1 }}><XCircle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Rejeitar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn-primary" onClick={() => setPicker(picker === 'aprovar' ? null : 'aprovar')}><ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Aprovar Plano</button>
            <button onClick={() => setPicker(picker === 'renovar' ? null : 'renovar')} style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '10px', color: 'var(--ouro)', fontWeight: 700, cursor: 'pointer' }}><RefreshCw size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Renovar</button>
            {picker && <PlanoPicker titulo={picker === 'aprovar' ? 'Aprovar qual plano?' : 'Renovar por quanto tempo?'} onEscolher={escolherPlano} onCancelar={() => setPicker(null)} />}
            <button onClick={cancelar} style={{ background: 'none', border: '1px solid var(--c3)', borderRadius: 8, padding: '10px', color: 'var(--texto2)', fontWeight: 700, cursor: 'pointer' }}>Cancelar Assinatura</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Zona de Risco</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={bloquear} style={{ flex: 1, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '10px', color: 'var(--texto2)', fontWeight: 700, cursor: 'pointer' }}>
            <Ban size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{u.bloqueado ? 'Desbloquear' : 'Bloquear'}
          </button>
          <button onClick={excluir} className="btn-danger" style={{ flex: 1 }}><Trash2 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Excluir Usuário</button>
        </div>
      </div>
    </>
  );
}

function AbaUsuarios() {
  const { usuarios, carregando, colunasFaltando, recarregar } = useUsuarios();
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState(null);

  const filtrados = usuarios.filter((u) => (u.nome || '').toLowerCase().includes(busca.toLowerCase()));

  if (selecionado) {
    const atual = usuarios.find((u) => u.id === selecionado.id) || selecionado;
    return <UsuarioDetalhe usuario={atual} onVoltar={() => setSelecionado(null)} onMudou={recarregar} />;
  }

  return (
    <>
      <div className="sel-card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '8px 10px' }}>
          <Search size={14} color="var(--texto2)" />
          <input type="text" placeholder="Pesquisar usuário..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ border: 'none', background: 'none', flex: 1, color: 'var(--texto)', outline: 'none' }} />
        </div>
      </div>
      {colunasFaltando && (
        <div style={{ fontSize: 10.5, color: 'var(--texto2)', background: 'var(--c2)', border: '1px solid var(--c3)', borderRadius: 8, padding: 8, marginBottom: 10 }}>
          ℹ️ Algumas colunas de assinatura ainda não existem nessa base — veja SUPABASE_SETUP.md.
        </div>
      )}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> Usuários ({filtrados.length})</div>
        {carregando ? (
          <div className="empty"><div className="icon"><Users size={22} /></div><p>Carregando...</p></div>
        ) : filtrados.length === 0 ? (
          <div className="empty"><div className="icon"><Users size={22} /></div><p>Nenhum usuário encontrado.</p></div>
        ) : filtrados.map((u) => {
          const st = statusUsuario(u);
          return (
            <div key={u.id} onClick={() => setSelecionado(u)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--c3)', cursor: 'pointer' }}>
              <StatusDot cor={st.cor} size={11} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.nome}</div>
                <div style={{ fontSize: 10.5, color: 'var(--texto2)' }}>{st.texto}{st.linha ? ' · ' + st.linha : ''}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AbaAssinaturas() {
  const { usuarios, carregando, recarregar } = useUsuarios();
  const [filtro, setFiltro] = useState('trial');
  const [abrirPara, setAbrirPara] = useState(null);

  const grupos = {
    trial: usuarios.filter((u) => u.status === 'aprovado' && (!u.plano || u.plano === '') && u.assinatura_status !== 'cancelado'),
    ativos: usuarios.filter((u) => u.status === 'aprovado' && u.plano && (diasRestantes(u.assinatura_vencimento) ?? 0) >= 0 && u.assinatura_status !== 'cancelado'),
    expirados: usuarios.filter((u) => u.status === 'aprovado' && (u.assinatura_status === 'cancelado' || (u.plano && (diasRestantes(u.assinatura_vencimento) ?? 0) < 0))),
  };
  const lista = grupos[filtro] || [];

  async function renovarRapido(u, p) {
    const r = await window.adminRenovarPlano(u.id, u.assinatura_vencimento, p.dias);
    if (!r.ok) { window.toast?.('⚠️ Erro ao renovar', true); return; }
    window.toast?.('✅ Renovado por mais ' + p.dias + ' dias'); recarregar();
  }
  async function trocarPlano(u, p) {
    const r = await window.adminAprovarPlano(u.id, p.id, p.dias);
    if (!r.ok) { window.toast?.('⚠️ Erro ao trocar plano', true); return; }
    window.toast?.('✅ Plano alterado para ' + p.nome); recarregar();
  }

  return (
    <>
      <div className="sub-nav" style={{ marginBottom: 14 }}>
        <button className={`sub-tab ${filtro === 'trial' ? 'active' : ''}`} onClick={() => setFiltro('trial')}>Teste Grátis ({grupos.trial.length})</button>
        <button className={`sub-tab ${filtro === 'ativos' ? 'active' : ''}`} onClick={() => setFiltro('ativos')}>Ativos ({grupos.ativos.length})</button>
        <button className={`sub-tab ${filtro === 'expirados' ? 'active' : ''}`} onClick={() => setFiltro('expirados')}>Expirados ({grupos.expirados.length})</button>
      </div>
      <div className="card">
        {carregando ? (
          <div className="empty"><div className="icon"><CreditCard size={22} /></div><p>Carregando...</p></div>
        ) : lista.length === 0 ? (
          <div className="empty"><div className="icon"><CreditCard size={22} /></div><p>Ninguém nesse grupo.</p></div>
        ) : lista.map((u) => {
          const st = statusUsuario(u);
          const aberto = abrirPara && abrirPara.id === u.id;
          return (
            <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--c3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StatusDot cor={st.cor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{u.nome}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--texto2)' }}>{st.texto}{st.linha ? ' · ' + st.linha : ''}</div>
                </div>
                <button onClick={() => setAbrirPara(aberto ? null : u)} style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 6, padding: '6px 10px', color: 'var(--ouro)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Gerenciar</button>
              </div>
              {aberto && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--texto2)' }}>Renovar / Alterar plano:</div>
                  {PLANOS_BASE.map((p) => (
                    <div key={p.id} style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => renovarRapido(u, p)} style={{ flex: 1, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 6, padding: '7px', color: 'var(--texto)', fontSize: 11.5, cursor: 'pointer' }}>Renovar {p.nome}</button>
                      <button onClick={() => trocarPlano(u, p)} style={{ flex: 1, background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 6, padding: '7px', color: 'var(--ouro)', fontSize: 11.5, cursor: 'pointer' }}>Virar {p.nome}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function AbaSistema() {
  const [cfg, setCfg] = useState(() => window.cfgAppLoad ? window.cfgAppLoad() : {});
  const [salvando, setSalvando] = useState(false);

  function salvar() {
    setSalvando(true);
    window.cfgAppSave?.(cfg);
    setTimeout(() => { setSalvando(false); window.toast?.('✅ Configurações salvas'); }, 300);
  }

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={14} /> Sistema</div>

      <div style={{ fontSize: 11, color: 'var(--texto2)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Valor da Assinatura</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div><label>Mensal (R$)</label><input type="number" step="0.01" value={cfg.precoMensal ?? ''} onChange={(e) => setCfg((c) => ({ ...c, precoMensal: parseFloat(e.target.value) || 0 }))} /></div>
        <div><label>Trimestral (R$)</label><input type="number" step="0.01" value={cfg.precoTrimestral ?? ''} onChange={(e) => setCfg((c) => ({ ...c, precoTrimestral: parseFloat(e.target.value) || 0 }))} /></div>
        <div><label>Semestral (R$)</label><input type="number" step="0.01" value={cfg.precoSemestral ?? ''} onChange={(e) => setCfg((c) => ({ ...c, precoSemestral: parseFloat(e.target.value) || 0 }))} /></div>
      </div>

      <div className="fg">
        <div><label>Dias de Teste Grátis</label><input type="number" value={cfg.diasTeste ?? ''} onChange={(e) => setCfg((c) => ({ ...c, diasTeste: parseInt(e.target.value) || 0 }))} /></div>
      </div>

      <button className="btn-primary" onClick={salvar} disabled={salvando}><Save size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{salvando ? 'Salvando...' : 'Salvar'}</button>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--c3)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--texto2)' }}>
        <span>Versão do aplicativo</span><strong style={{ color: 'var(--texto)' }}>Ei Placar v1.0</strong>
      </div>
    </div>
  );
}

export default function Administracao() {
  const [tab, setTab] = useState('usuarios');
  return (
    <>
      <div className="sub-nav" style={{ marginBottom: 14 }}>
        <button className={`sub-tab ${tab === 'usuarios' ? 'active' : ''}`} onClick={() => setTab('usuarios')}><Users size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Usuários</button>
        <button className={`sub-tab ${tab === 'assinaturas' ? 'active' : ''}`} onClick={() => setTab('assinaturas')}><CreditCard size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Assinaturas</button>
        <button className={`sub-tab ${tab === 'sistema' ? 'active' : ''}`} onClick={() => setTab('sistema')}><Settings size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Sistema</button>
      </div>
      {tab === 'usuarios' && <AbaUsuarios />}
      {tab === 'assinaturas' && <AbaAssinaturas />}
      {tab === 'sistema' && <AbaSistema />}
    </>
  );
}
