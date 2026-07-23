import { useEffect, useRef, useState } from 'react';
import { User, Settings, Camera, CreditCard, ShieldHalf, Moon, Bell, Lock, Info, LogOut, ChevronRight, CheckCircle2, Save } from 'lucide-react';

// ══ Conta — Perfil + Configurações ══
//
// Perfil: foto, dados pessoais (nome/data nasc./telefone/e-mail) e Assinatura.
//   - window.buscarPerfilCompleto() / window.salvarPerfil(campos) → public/js/01-config-auth.js
//   - Os campos extras (telefone, data_nascimento, foto_url, plano...) ficam na tabela
//     "perfis" do Supabase — se essas colunas ainda não existirem na base do usuário, a
//     tela cai pra um modo "somente nome" (sem quebrar) até a migração ser feita lá.
//   - Assinatura é só EXIBIÇÃO por enquanto — não existe cobrança real integrada ainda;
//     escolher um plano mostra um aviso em vez de "fingir" que cobrou algo.
//
// Configurações: tema, notificações, reserva automática, senha, sobre, sair.
//   - window.bancaSalvarProtecao(ativa,pct) → public/js/14-banca-gestao.js
//   - window.alterarSenhaLogado(senha) → public/js/01-config-auth.js
//   - window.fazerLogout() → public/js/01-config-auth.js

function planosAtuais() {
  const c = window.cfgAppLoad ? window.cfgAppLoad() : {};
  return [
    { id: 'mensal', nome: 'Mensal', preco: c.precoMensal ?? 9.90, periodo: '/mês', dias: 30 },
    { id: 'trimestral', nome: 'Trimestral', preco: c.precoTrimestral ?? 24.99, periodo: '/3 meses', dias: 90 },
    { id: 'semestral', nome: 'Semestral', preco: c.precoSemestral ?? 19.99, periodo: '/6 meses', dias: 180 },
  ];
}

function diasRestantes(vencimento) {
  if (!vencimento) return null;
  const d = Math.ceil((new Date(vencimento + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
  return d;
}
function fdBr(s) { return window.fd ? window.fd(s) : s; }

function Row({ icone: Icone, label, children, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 2px', borderBottom: '1px solid var(--c3)', cursor: onClick ? 'pointer' : 'default' }}>
      <Icone size={16} style={{ color: 'var(--texto2)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
}
function Toggle({ ativo, onChange }) {
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, flexShrink: 0 }}>
      <span onClick={() => onChange(!ativo)} style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: ativo ? 'var(--verde2)' : 'var(--c3)', borderRadius: 22, transition: '.2s' }}>
        <span style={{ position: 'absolute', height: 16, width: 16, left: ativo ? 21 : 3, bottom: 3, background: '#fff', borderRadius: '50%', transition: '.2s' }} />
      </span>
    </label>
  );
}

function AbaPerfil() {
  const [perfil, setPerfil] = useState({ nome: '', telefone: '', data_nascimento: '', foto_url: '', plano: '', assinatura_status: '', assinatura_inicio: '', assinatura_vencimento: '' });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [colunasFaltando, setColunasFaltando] = useState(false);
  const [verPlanos, setVerPlanos] = useState(false);
  const fileRef = useRef(null);

  async function carregar() {
    setCarregando(true);
    const r = await window.buscarPerfilCompleto();
    setColunasFaltando(!r.ok);
    setPerfil((p) => ({ ...p, ...r.dados }));
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    setSalvando(true);
    const r = await window.salvarPerfil({ nome: perfil.nome, telefone: perfil.telefone, data_nascimento: perfil.data_nascimento || null });
    setSalvando(false);
    if (!r.ok) { window.toast?.('⚠️ ' + r.msg, true); return; }
    window.toast?.('✅ Dados salvos');
  }

  function escolherFoto() { fileRef.current?.click(); }
  function onFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { window.toast?.('⚠️ Escolha uma foto menor (até 1,5MB)', true); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result;
      setPerfil((p) => ({ ...p, foto_url: dataUri }));
      const r = await window.salvarPerfil({ foto_url: dataUri });
      if (!r.ok) window.toast?.('⚠️ ' + r.msg, true); else window.toast?.('✅ Foto atualizada');
    };
    reader.readAsDataURL(file);
  }

  const dias = diasRestantes(perfil.assinatura_vencimento);
  const emTeste = !perfil.plano || perfil.plano === 'teste_gratis';

  return (
    <>
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--c1)', border: '2px solid var(--c3)', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {perfil.foto_url ? <img src={perfil.foto_url} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={36} color="var(--texto2)" />}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFoto} style={{ display: 'none' }} />
        <button onClick={escolherFoto} style={{ background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '7px 14px', color: 'var(--ouro)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Camera size={13} /> Alterar Foto
        </button>
      </div>

      <div className="card">
        {colunasFaltando && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 10.5, color: 'var(--texto2)', background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: 8, marginBottom: 10 }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Telefone, data de nascimento e foto ainda não têm onde ser salvos nesta base (faltam colunas na tabela "perfis" do Supabase). O nome já funciona normalmente.
          </div>
        )}
        <div className="fg">
          <div><label>Nome</label><input type="text" value={perfil.nome || ''} onChange={(e) => setPerfil((p) => ({ ...p, nome: e.target.value }))} disabled={carregando} /></div>
        </div>
        <div className="fg fg2">
          <div><label>Data de Nascimento</label><input type="date" value={perfil.data_nascimento || ''} onChange={(e) => setPerfil((p) => ({ ...p, data_nascimento: e.target.value }))} disabled={carregando} /></div>
          <div><label>Telefone</label><input type="tel" placeholder="(00) 00000-0000" value={perfil.telefone || ''} onChange={(e) => setPerfil((p) => ({ ...p, telefone: e.target.value }))} disabled={carregando} /></div>
        </div>
        <div className="fg">
          <div><label>E-mail</label><input type="email" value={window.authGetSessao?.()?.email || ''} disabled style={{ opacity: .6 }} /></div>
        </div>
        <button className="btn-primary" onClick={salvar} disabled={salvando || carregando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{salvando ? 'Salvando...' : <><Save size={13} /> Salvar</>}</button>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CreditCard size={14} /> Assinatura</div>
        {emTeste ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>Plano</span><strong>Teste Gratuito</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>Status</span><strong style={{ color: '#4dd87a', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Ativo</strong></div>
              {perfil.assinatura_inicio && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>Início</span><strong>{fdBr(perfil.assinatura_inicio)}</strong></div>}
              {perfil.assinatura_vencimento && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>Vencimento</span><strong>{fdBr(perfil.assinatura_vencimento)}</strong></div>}
              {dias != null && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>Dias restantes</span><strong style={{ color: dias <= 7 ? '#f08060' : 'var(--ouro)' }}>{dias}</strong></div>}
            </div>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setVerPlanos((v) => !v)}>Renovar Assinatura</button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>Plano</span><strong>{planosAtuais().find((p) => p.id === perfil.plano)?.nome || perfil.plano}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--texto2)' }}>Próximo vencimento</span><strong>{fdBr(perfil.assinatura_vencimento)}</strong></div>
            <div style={{ fontSize: 11, color: 'var(--texto2)', marginTop: 6 }}>Histórico de pagamentos: em breve.</div>
          </div>
        )}

        {verPlanos && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--c3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {planosAtuais().map((p) => (
              <button key={p.id} onClick={() => window.toast?.('💳 Pagamento ainda não conectado — em breve você poderá assinar o plano ' + p.nome + ' por aqui.')}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--c1)', border: '1px solid var(--c3)', borderRadius: 8, padding: '10px 12px', color: 'var(--texto)', cursor: 'pointer' }}>
                <span style={{ fontWeight: 700 }}>{p.nome}</span>
                <span style={{ color: 'var(--ouro)', fontWeight: 800 }}>R$ {p.preco.toFixed(2).replace('.', ',')} <span style={{ color: 'var(--texto2)', fontWeight: 400, fontSize: 11 }}>{p.periodo}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AbaConfiguracoes() {
  const [tema, setTema] = useState(() => { try { return localStorage.getItem('eiPlacar_tema') || 'dark'; } catch { return 'dark'; } });
  const [notif, setNotif] = useState(() => { try { return localStorage.getItem('eiPlacar_notif') === '1'; } catch { return false; } });
  const [reservaAtiva, setReservaAtiva] = useState(true);
  const [reservaPct, setReservaPct] = useState(10);
  const [editarReserva, setEditarReserva] = useState(false);
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [senha1, setSenha1] = useState('');
  const [senha2, setSenha2] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [sobreAberto, setSobreAberto] = useState(false);

  useEffect(() => {
    const d = window.bpLoad?.();
    if (d) { setReservaAtiva(d.protecaoAtiva !== false); setReservaPct(d.protecaoPct ?? 10); }
  }, []);

  function alternarTema(claro) {
    const novo = claro ? 'light' : 'dark';
    setTema(novo);
    try { localStorage.setItem('eiPlacar_tema', novo); } catch {}
    document.documentElement.dataset.theme = novo === 'light' ? 'light' : '';
  }

  async function alternarNotif(ligar) {
    if (ligar && typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { window.toast?.('⚠️ Permissão de notificação negada pelo navegador', true); return; }
    }
    setNotif(ligar);
    try { localStorage.setItem('eiPlacar_notif', ligar ? '1' : '0'); } catch {}
  }

  function salvarReserva(ativa, pct) {
    setReservaAtiva(ativa); setReservaPct(pct);
    window.bancaSalvarProtecao?.(ativa, pct);
  }

  async function salvarSenha() {
    if (senha1.length < 6) { window.toast?.('⚠️ Mínimo de 6 caracteres', true); return; }
    if (senha1 !== senha2) { window.toast?.('⚠️ As senhas não coincidem', true); return; }
    setSalvandoSenha(true);
    const r = await window.alterarSenhaLogado(senha1);
    setSalvandoSenha(false);
    if (!r.ok) { window.toast?.('⚠️ ' + r.msg, true); return; }
    window.toast?.('✅ Senha alterada!');
    setSenha1(''); setSenha2(''); setAlterandoSenha(false);
  }

  return (
    <div className="card" style={{ paddingBottom: 4 }}>
      <Row icone={Moon} label="Tema Escuro">
        <Toggle ativo={tema !== 'light'} onChange={(v) => alternarTema(!v)} />
      </Row>
      <Row icone={Bell} label="Notificações">
        <Toggle ativo={notif} onChange={alternarNotif} />
      </Row>

      <Row icone={ShieldHalf} label="Reserva Automática" onClick={() => setEditarReserva((v) => !v)}>
        <span style={{ color: 'var(--ouro)', fontWeight: 700, fontSize: 12.5 }}>{reservaAtiva ? reservaPct + '%' : 'Desativada'}</span>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>
      {editarReserva && (
        <div style={{ padding: '10px 2px 14px', borderBottom: '1px solid var(--c3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12.5 }}>Separar lucro para reserva</span>
            <Toggle ativo={reservaAtiva} onChange={(v) => salvarReserva(v, reservaPct)} />
          </div>
          <div style={{ display: 'flex', gap: 8, opacity: reservaAtiva ? 1 : .4, pointerEvents: reservaAtiva ? 'auto' : 'none' }}>
            {[5, 10, 15, 20].map((p) => (
              <button key={p} onClick={() => salvarReserva(reservaAtiva, p)} className={`btn-pct ${reservaPct === p ? 'ativo' : ''}`} style={{ flex: 1 }}>{p}%</button>
            ))}
          </div>
        </div>
      )}

      <Row icone={Lock} label="Alterar Senha" onClick={() => setAlterandoSenha((v) => !v)}>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>
      {alterandoSenha && (
        <div style={{ padding: '10px 2px 14px', borderBottom: '1px solid var(--c3)' }}>
          <div className="fg">
            <div><label>Nova senha</label><input type="password" value={senha1} onChange={(e) => setSenha1(e.target.value)} placeholder="mínimo 6 caracteres" /></div>
          </div>
          <div className="fg">
            <div><label>Confirmar nova senha</label><input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} /></div>
          </div>
          <button className="btn-primary" onClick={salvarSenha} disabled={salvandoSenha} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{salvandoSenha ? 'Salvando...' : <><Lock size={13} /> Salvar nova senha</>}</button>
        </div>
      )}

      <Row icone={Info} label="Sobre" onClick={() => setSobreAberto((v) => !v)}>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>
      {sobreAberto && (
        <div style={{ padding: '4px 2px 14px', borderBottom: '1px solid var(--c3)', fontSize: 12, color: 'var(--texto2)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--texto)' }}>EI PLACAR</strong> é uma plataforma de inteligência esportiva desenvolvida para transformar dados em informações claras, confiáveis e relevantes — análises e estatísticas que ajudam a entender melhor o desempenho das equipes e das partidas.
          </p>
          <p style={{ marginBottom: 10 }}>
            Não é uma plataforma de apostas. É uma plataforma de dados, estatísticas e análises.
          </p>
          <p style={{ marginBottom: 10, fontWeight: 700, color: 'var(--texto)' }}>Uso responsável</p>
          <p>
            As informações do EI PLACAR têm finalidade exclusivamente informativa e não constituem garantia de resultados ou ganhos. O futebol é um esporte imprevisível: nenhum dado é capaz de prever resultados com certeza. O uso dessas informações em apostas esportivas é de exclusiva responsabilidade do usuário.
          </p>
        </div>
      )}

      <Row icone={LogOut} label="Sair" onClick={() => window.fazerLogout?.()}>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>
    </div>
  );
}

export default function MinhaConta() {
  const [tab, setTab] = useState('perfil');
  return (
    <>
      <div className="sub-nav" style={{ marginBottom: 14 }}>
        <button className={`sub-tab ${tab === 'perfil' ? 'active' : ''}`} onClick={() => setTab('perfil')}>
          <User size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Perfil
        </button>
        <button className={`sub-tab ${tab === 'configuracoes' ? 'active' : ''}`} onClick={() => setTab('configuracoes')}>
          <Settings size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Configurações
        </button>
      </div>

      <div className={`sub-page ${tab === 'perfil' ? 'active' : ''}`}><AbaPerfil /></div>
      <div className={`sub-page ${tab === 'configuracoes' ? 'active' : ''}`}><AbaConfiguracoes /></div>
    </>
  );
}
