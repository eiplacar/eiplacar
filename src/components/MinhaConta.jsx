import { useEffect, useRef, useState } from 'react';
import { User, Settings, Camera, CreditCard, ShieldHalf, Moon, Bell, Lock, Info, LogOut, ChevronRight, CheckCircle2, Save, Target } from 'lucide-react';

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
  const [verPlanos, setVerPlanos] = useState(false);
  const fileRef = useRef(null);

  async function carregar() {
    setCarregando(true);
    const r = await window.buscarPerfilCompleto();
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
  const [metaDiaria, setMetaDiaria] = useState(0);
  const [stopGain, setStopGain] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [editarStopMeta, setEditarStopMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');
  const [stopGainInput, setStopGainInput] = useState('');
  const [stopLossInput, setStopLossInput] = useState('');
  const [salvandoStopMeta, setSalvandoStopMeta] = useState(false);
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [senha1, setSenha1] = useState('');
  const [senha2, setSenha2] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [sobreAberto, setSobreAberto] = useState(false);
  const [privacidadeAberta, setPrivacidadeAberta] = useState(false);
  const [termosAbertos, setTermosAbertos] = useState(false);

  useEffect(() => {
    const d = window.bpLoad?.();
    if (d) {
      setReservaAtiva(d.protecaoAtiva !== false); setReservaPct(d.protecaoPct ?? 10);
      setMetaDiaria(d.metaDiaria ?? 0); setStopGain(d.stopGain ?? 0); setStopLoss(d.stopLoss ?? 0);
      setMetaInput(d.metaDiaria ? String(d.metaDiaria) : '');
      setStopGainInput(d.stopGain ? String(d.stopGain) : '');
      setStopLossInput(d.stopLoss ? String(d.stopLoss) : '');
    }
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

  async function salvarStopMeta() {
    setSalvandoStopMeta(true);
    const meta = parseFloat(metaInput) || 0;
    const gain = parseFloat(stopGainInput) || 0;
    const loss = parseFloat(stopLossInput) || 0;
    window.bancaSalvarStopMeta?.(meta, gain, loss);
    setMetaDiaria(meta); setStopGain(gain); setStopLoss(loss);
    setSalvandoStopMeta(false);
    window.toast?.('✅ Stop e Meta salvos');
    window.__bancaCarteiraTick?.();
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

      <Row icone={Target} label="Stop e Meta" onClick={() => setEditarStopMeta((v) => !v)}>
        <span style={{ color: 'var(--ouro)', fontWeight: 700, fontSize: 12.5 }}>
          {metaDiaria > 0 || stopGain > 0 || stopLoss > 0 ? `Meta R$${metaDiaria}` : 'Não definido'}
        </span>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>
      {editarStopMeta && (
        <div style={{ padding: '10px 2px 14px', borderBottom: '1px solid var(--c3)' }}>
          <div style={{ fontSize: 11, color: 'var(--texto2)', marginBottom: 10 }}>
            Configure sua meta de lucro e seus limites de stop (gain e loss) por dia. Eles aparecem na aba Banca → Evolução, mostrando se já bateu a meta ou já deve parar por hoje.
          </div>
          <div className="fg">
            <div><label>Meta Diária (R$)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={metaInput} onChange={(e) => setMetaInput(e.target.value)} /></div>
          </div>
          <div className="fg fg2">
            <div><label>Stop Gain (R$)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={stopGainInput} onChange={(e) => setStopGainInput(e.target.value)} /></div>
            <div><label>Stop Loss (R$)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={stopLossInput} onChange={(e) => setStopLossInput(e.target.value)} /></div>
          </div>
          <button className="btn-primary" onClick={salvarStopMeta} disabled={salvandoStopMeta} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{salvandoStopMeta ? 'Salvando...' : <><Save size={13} /> Salvar</>}</button>
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
          <p style={{ marginBottom: 10, fontWeight: 700, color: 'var(--texto)' }}>Sobre o EI PLACAR</p>
          <p style={{ marginBottom: 10 }}>
            O EI PLACAR é uma plataforma de inteligência esportiva desenvolvida para transformar dados em informações claras, confiáveis e relevantes.
          </p>
          <p style={{ marginBottom: 10 }}>
            Nossa missão é oferecer estatísticas e análises que auxiliem os usuários a compreender melhor o desempenho das equipes e das partidas, contribuindo para uma visão mais completa do futebol por meio de dados.
          </p>
          <p style={{ marginBottom: 10 }}>
            O EI PLACAR não é uma plataforma de apostas. É uma plataforma dedicada à análise de dados, estatísticas e informações esportivas, desenvolvida para quem busca acompanhar o futebol com mais conhecimento e embasamento.
          </p>
          <p style={{ marginBottom: 14 }}>
            Nosso compromisso é fornecer informações organizadas, confiáveis e de fácil compreensão, sempre buscando aprimorar a experiência dos usuários e a qualidade dos conteúdos disponibilizados.
          </p>
          <p style={{ marginBottom: 2 }}>Versão: 2.1.0</p>
          <p>© 2026 EI PLACAR. Todos os direitos reservados.</p>
        </div>
      )}

      <Row icone={ShieldHalf} label="Política de Privacidade" onClick={() => setPrivacidadeAberta((v) => !v)}>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>
      {privacidadeAberta && (
        <div style={{ padding: '4px 2px 14px', borderBottom: '1px solid var(--c3)', fontSize: 12, color: 'var(--texto2)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 10, fontWeight: 700, color: 'var(--texto)' }}>Política de Privacidade</p>
          <p style={{ marginBottom: 10 }}>Última atualização: 2026</p>
          <p style={{ marginBottom: 10 }}>
            O EI PLACAR respeita a privacidade dos seus usuários e está comprometido com a proteção dos dados pessoais.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>1. Coleta de informações</p>
          <p style={{ marginBottom: 10 }}>
            Coletamos apenas as informações necessárias para o funcionamento da plataforma, como nome, e-mail, telefone (quando informado) e demais dados fornecidos pelo usuário durante o cadastro.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>2. Uso das informações</p>
          <p style={{ marginBottom: 4 }}>As informações coletadas são utilizadas para:</p>
          <p style={{ marginBottom: 10 }}>
            Identificar o usuário na plataforma; gerenciar assinaturas e acessos; melhorar a experiência de uso; enviar comunicações importantes sobre o serviço.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>3. Compartilhamento de dados</p>
          <p style={{ marginBottom: 10 }}>
            O EI PLACAR não vende nem comercializa dados pessoais dos usuários. As informações poderão ser compartilhadas apenas quando exigido por lei ou quando necessário para o funcionamento dos serviços contratados.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>4. Segurança</p>
          <p style={{ marginBottom: 10 }}>
            Adotamos medidas de segurança para proteger os dados dos usuários contra acesso não autorizado, alteração, divulgação ou destruição.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>5. Cookies</p>
          <p style={{ marginBottom: 10 }}>
            O aplicativo poderá utilizar tecnologias semelhantes a cookies para melhorar a experiência do usuário e analisar o uso da plataforma.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>6. Direitos do usuário</p>
          <p style={{ marginBottom: 10 }}>
            O usuário poderá solicitar a atualização, correção ou exclusão de seus dados, conforme permitido pela legislação aplicável.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>7. Alterações</p>
          <p style={{ marginBottom: 10 }}>
            Esta Política de Privacidade poderá ser atualizada a qualquer momento. A versão mais recente estará sempre disponível no aplicativo.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>8. Contato</p>
          <p>
            Em caso de dúvidas sobre esta Política de Privacidade, entre em contato pelos canais oficiais de suporte do EI PLACAR.
          </p>
        </div>
      )}

      <Row icone={Info} label="Termos de Uso" onClick={() => setTermosAbertos((v) => !v)}>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>
      {termosAbertos && (
        <div style={{ padding: '4px 2px 14px', borderBottom: '1px solid var(--c3)', fontSize: 12, color: 'var(--texto2)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 10, fontWeight: 700, color: 'var(--texto)' }}>Termos de Uso</p>
          <p style={{ marginBottom: 10 }}>Última atualização: 2026</p>
          <p style={{ marginBottom: 10 }}>
            Bem-vindo ao EI PLACAR. Ao acessar ou utilizar a plataforma, o usuário declara que leu, compreendeu e concorda com os presentes Termos de Uso.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>1. Objetivo da Plataforma</p>
          <p style={{ marginBottom: 4 }}>
            O EI PLACAR é uma plataforma de inteligência esportiva que disponibiliza dados, estatísticas e análises sobre partidas e equipes de futebol, com finalidade exclusivamente informativa.
          </p>
          <p style={{ marginBottom: 10 }}>
            O EI PLACAR não realiza apostas esportivas, não intermedeia apostas e não garante resultados de eventos esportivos.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>2. Idade Mínima</p>
          <p style={{ marginBottom: 10 }}>
            O EI PLACAR é destinado a usuários com 18 (dezoito) anos ou mais. Ao utilizar a plataforma, o usuário declara possuir idade igual ou superior a 18 anos e estar legalmente apto a utilizar os serviços oferecidos.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>3. Uso da Plataforma</p>
          <p style={{ marginBottom: 4 }}>
            O usuário compromete-se a utilizar a plataforma de forma responsável, ética e em conformidade com a legislação vigente.
          </p>
          <p style={{ marginBottom: 10 }}>
            É proibida a utilização do EI PLACAR para atividades ilícitas, fraudulentas ou que possam prejudicar a plataforma, seus serviços ou outros usuários.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>4. Uso das Informações</p>
          <p style={{ marginBottom: 4 }}>
            As estatísticas, análises e demais conteúdos disponibilizados possuem caráter exclusivamente informativo.
          </p>
          <p style={{ marginBottom: 4 }}>
            O futebol é um esporte imprevisível e nenhuma informação disponibilizada pelo EI PLACAR constitui garantia de resultados futuros.
          </p>
          <p style={{ marginBottom: 10 }}>
            Qualquer decisão tomada pelo usuário com base nas informações fornecidas é de sua exclusiva responsabilidade.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>5. Propriedade Intelectual</p>
          <p style={{ marginBottom: 4 }}>
            Todo o conteúdo disponibilizado pelo EI PLACAR, incluindo identidade visual, logotipos, textos, gráficos, análises, estatísticas e demais materiais, é protegido pela legislação de direitos autorais e de propriedade intelectual.
          </p>
          <p style={{ marginBottom: 10 }}>
            É proibida a reprodução, distribuição ou utilização desses conteúdos sem autorização prévia do EI PLACAR.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>6. Disponibilidade dos Serviços</p>
          <p style={{ marginBottom: 10 }}>
            O EI PLACAR busca manter seus serviços disponíveis continuamente. Entretanto, poderão ocorrer interrupções temporárias decorrentes de manutenção, atualização, falhas técnicas ou fatores externos.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>7. Alterações dos Termos</p>
          <p style={{ marginBottom: 10 }}>
            Os presentes Termos de Uso poderão ser alterados a qualquer momento. A versão mais recente estará sempre disponível no aplicativo.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>8. Contato</p>
          <p>
            Em caso de dúvidas sobre estes Termos de Uso, entre em contato pelos canais oficiais de suporte do EI PLACAR.
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
  function trocarTab(t) { window.toastEsconder?.(); setTab(t); }
  return (
    <>
      <div className="sub-nav" style={{ marginBottom: 14 }}>
        <button className={`sub-tab ${tab === 'perfil' ? 'active' : ''}`} onClick={() => trocarTab('perfil')}>
          <User size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Perfil
        </button>
        <button className={`sub-tab ${tab === 'configuracoes' ? 'active' : ''}`} onClick={() => trocarTab('configuracoes')}>
          <Settings size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Configurações
        </button>
      </div>

      <div className={`sub-page ${tab === 'perfil' ? 'active' : ''}`}><AbaPerfil /></div>
      <div className={`sub-page ${tab === 'configuracoes' ? 'active' : ''}`}><AbaConfiguracoes /></div>
    </>
  );
}
