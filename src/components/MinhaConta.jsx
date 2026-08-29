import { useEffect, useRef, useState } from 'react';
import { User, Settings, Camera, ShieldHalf, Moon, Bell, Lock, Info, LogOut, ChevronRight, Save, Target, Mail, MessageCircle } from 'lucide-react';

// ══ Conta — Perfil + Configurações ══
//
// Perfil: foto, dados pessoais (nome/data nasc./telefone/e-mail).
//   - window.buscarPerfilCompleto() / window.salvarPerfil(campos) → public/js/01-config-auth.js
//   - Os campos extras (telefone, data_nascimento, foto_url, plano...) ficam na tabela
//     "perfis" do Supabase — se essas colunas ainda não existirem na base do usuário, a
//     tela cai pra um modo "somente nome" (sem quebrar) até a migração ser feita lá.
//   - Assinatura (planos, Pix, cancelamento) mora só na aba "Seja Assinante" do menu
//     lateral (public/js/16-admin.js, página #page-assinar) — não duplica aqui.
//
// Configurações: tema, notificações, reserva automática, senha, sobre, sair.
//   - window.bancaSalvarProtecao(ativa,pct) → public/js/14-banca-gestao.js
//   - window.alterarSenhaLogado(senha) → public/js/01-config-auth.js
//   - window.fazerLogout() → public/js/01-config-auth.js

// Abre o app de e-mail padrão do usuário (Gmail, Outlook, app nativo do celular etc.)
// já com o destinatário e assunto preenchidos — não precisa digitar nada.
function abrirEmail(destino, assunto) {
  window.location.href = `mailto:${destino}?subject=${encodeURIComponent(assunto)}`;
}

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
  const fileRef = useRef(null);

  async function carregar() {
    setCarregando(true);
    const r = await window.buscarPerfilCompleto();
    setPerfil((p) => ({ ...p, ...r.dados }));
    setCarregando(false);
  }
  useEffect(() => {
    // Carrega já na primeira montagem...
    carregar();
    // ...e registra o "sininho" que o goTo('minhaconta') chama toda vez que a aba é
    // aberta (window.perfilRefresh). Sem isso, os dados só eram buscados uma única vez,
    // na primeira montagem do app — o que causava duas falhas:
    // 1) Se nesse instante o perfil da sessão ainda não tivesse chegado (corrida com o
    //    carregamento inicial), os campos ficavam vazios PRA SEMPRE, só voltando com um
    //    reload completo da página.
    // 2) Ao trocar de conta (ADM ↔ membro) sem recarregar a página inteira, a tela
    //    continuava mostrando os dados da conta anterior, dando a falsa impressão de que
    //    uma conta estava "vazando" dados pra outra — na verdade era só a tela desatualizada.
    window.perfilRefresh = () => carregar();
    return () => { delete window.perfilRefresh; };
  }, []);

  async function salvar() {
    setSalvando(true);
    const r = await window.salvarPerfil({ nome: perfil.nome, telefone: perfil.telefone, data_nascimento: perfil.data_nascimento || null });
    setSalvando(false);
    if (!r.ok) { window.toast?.('' + r.msg, true); return; }
    window.toast?.('Dados salvos');
  }

  function escolherFoto() { fileRef.current?.click(); }

  // Redimensiona/comprime a foto antes de salvar. Antes, a foto ia direto pro banco
  // em base64 do arquivo original (até 1,5MB vira ~2MB de texto) — fotos de celular
  // hoje em dia passam fácil disso, e um payload grande desse jeito podia ser
  // recusado pelo Supabase (limite de tamanho de requisição) SEM erro nenhum
  // aparecer com clareza, dando a impressão de "a foto não salva". Reduzindo pra no
  // máximo 512px e comprimindo em JPEG, o arquivo final fica na casa de poucos KB.
  function comprimirImagem(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = 512;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler essa imagem')); };
      img.src = url;
    });
  }

  async function onFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { window.toast?.('Escolha uma foto menor (até 8MB)', true); return; }
    try {
      const dataUri = await comprimirImagem(file);
      setPerfil((p) => ({ ...p, foto_url: dataUri }));
      const r = await window.salvarPerfil({ foto_url: dataUri });
      if (!r.ok) window.toast?.('' + r.msg, true); else window.toast?.('Foto atualizada');
    } catch (err) {
      window.toast?.('Não foi possível processar essa foto: ' + err.message, true);
    }
  }

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
          <div><label>E-mail</label><input type="email" value={window.authGetSessao?.()?.user?.email || ''} disabled style={{ opacity: .6 }} /></div>
        </div>
        <button className="btn-primary" onClick={salvar} disabled={salvando || carregando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{salvando ? 'Salvando...' : <><Save size={13} /> Salvar</>}</button>
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

  // CAUSA DA STOP/META SEMPRE VAZIA (investigado): este componente já é montado no
  // carregamento da página (src/main.jsx roda todos os createRoot de uma vez, mesmo
  // enquanto a tela de login ainda está por cima) — ou seja, esse useEffect roda quase
  // imediatamente, muito antes da busca da Banca na nuvem (bpCarregarNuvem, disparada em
  // paralelo lá em 15-init.js/authIniciarSessao) terminar. window.bpLoad() só lê o que já
  // tiver em memória NESSE instante; se a nuvem ainda não respondeu, bancaCache está vazio
  // e os campos caem nos valores padrão (Meta/Stop = 0, Reserva = 10% — que por coincidência
  // é o próprio valor padrão, por isso parecia "certo"). Como esse efeito só roda uma vez e
  // nunca mais, os valores reais da nuvem nunca chegavam a aparecer.
  // Correção: função de carregamento reaproveitável, que também aguarda a nuvem (não só o
  // cache) e é registrada em window.configuracoesRefresh — chamada pelo goTo('minhaconta')
  // toda vez que a aba é reaberta, garantindo que já deu tempo da resposta da nuvem chegar.
  function carregarBancaConfig(d) {
    if (!d) return;
    setReservaAtiva(d.protecaoAtiva !== false); setReservaPct(d.protecaoPct ?? 10);
    setMetaDiaria(d.metaDiaria ?? 0); setStopGain(d.stopGain ?? 0); setStopLoss(d.stopLoss ?? 0);
    setMetaInput(d.metaDiaria ? String(d.metaDiaria) : '');
    setStopGainInput(d.stopGain ? String(d.stopGain) : '');
    setStopLossInput(d.stopLoss ? String(d.stopLoss) : '');
  }
  useEffect(() => {
    carregarBancaConfig(window.bpLoad?.());
    window.configuracoesRefresh = async () => {
      if (window.bpCarregarNuvem) await window.bpCarregarNuvem();
      carregarBancaConfig(window.bpLoad?.());
    };
    return () => { delete window.configuracoesRefresh; };
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
      if (perm !== 'granted') { window.toast?.('Permissão de notificação negada pelo navegador', true); return; }
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
    window.toast?.('Stop e Meta salvos');
    window.__bancaCarteiraTick?.();
  }

  async function salvarSenha() {
    if (senha1.length < 6) { window.toast?.('Mínimo de 6 caracteres', true); return; }
    if (senha1 !== senha2) { window.toast?.('As senhas não coincidem', true); return; }
    setSalvandoSenha(true);
    const r = await window.alterarSenhaLogado(senha1);
    setSalvandoSenha(false);
    if (!r.ok) { window.toast?.('' + r.msg, true); return; }
    window.toast?.('Senha alterada!');
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

      <Row icone={Mail} label="Falar com o Suporte" onClick={() => abrirEmail('suporte@eiplacar.com.br', 'Suporte - EI PLACAR')}>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>

      <Row icone={MessageCircle} label="Enviar Sugestão" onClick={() => abrirEmail('sugestoes@eiplacar.com.br', 'Sugestão - EI PLACAR')}>
        <ChevronRight size={15} style={{ color: 'var(--texto2)' }} />
      </Row>

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
            O EI PLACAR respeita a privacidade dos seus usuários e está comprometido com a proteção dos dados pessoais e com a transparência no tratamento das informações.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>1. Coleta de informações</p>
          <p style={{ marginBottom: 6 }}>
            Coletamos apenas as informações necessárias para o funcionamento da plataforma, como nome, e-mail, telefone (quando informado) e demais dados fornecidos pelo usuário durante o cadastro e utilização do serviço.
          </p>
          <p style={{ marginBottom: 10 }}>
            O EI PLACAR poderá também receber informações relacionadas à utilização da plataforma e à contratação dos serviços.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>2. Uso das informações</p>
          <p style={{ marginBottom: 4 }}>As informações coletadas são utilizadas para:</p>
          <p style={{ marginBottom: 10 }}>
            • Identificar e autenticar o usuário na plataforma;<br />
            • Gerenciar contas e acessos;<br />
            • Disponibilizar os recursos contratados;<br />
            • Processar e confirmar pagamentos;<br />
            • Melhorar a experiência de uso da plataforma;<br />
            • Enviar comunicações importantes relacionadas ao serviço;<br />
            • Cumprir obrigações legais e regulatórias, quando aplicável.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>3. Pagamentos e Mercado Pago</p>
          <p style={{ marginBottom: 6 }}>
            Para realizar o processamento dos pagamentos, o EI PLACAR utiliza os serviços do Mercado Pago.
          </p>
          <p style={{ marginBottom: 6 }}>
            Durante o processo de pagamento, o usuário poderá ser direcionado ao ambiente ou fluxo de pagamento disponibilizado pelo Mercado Pago. Dependendo do meio de pagamento utilizado, o Mercado Pago poderá solicitar informações adicionais, incluindo CPF, e-mail ou outros dados necessários para identificação, validação e processamento da transação.
          </p>
          <p style={{ marginBottom: 6 }}>
            A eventual solicitação de CPF durante o pagamento não significa que o CPF seja necessário para criar ou manter o cadastro do usuário no EI PLACAR. Quando solicitado, o dado está relacionado ao processamento e à validação da transação pelo Mercado Pago.
          </p>
          <p style={{ marginBottom: 6 }}>
            Nos pagamentos via Pix, o Mercado Pago poderá gerar e disponibilizar QR Code e/ou código Pix Copia e Cola para que o usuário conclua a transação.
          </p>
          <p style={{ marginBottom: 6 }}>
            Cada pagamento libera o período de acesso adquirido (30, 90 ou 180 dias, conforme o plano escolhido). O EI PLACAR não realiza cobranças automáticas: ao final do período contratado, o usuário decide se deseja realizar um novo pagamento para continuar utilizando a plataforma.
          </p>
          <p style={{ marginBottom: 6 }}>
            Os pagamentos são processados pelo Mercado Pago. Os dados financeiros e as informações necessárias para a realização da transação são tratados pelo Mercado Pago, conforme seus termos e políticas aplicáveis. O EI PLACAR não armazena dados financeiros sensíveis utilizados para a realização do pagamento.
          </p>
          <p style={{ marginBottom: 10 }}>
            Para identificar e confirmar o pagamento e liberar o serviço contratado, o EI PLACAR poderá receber e armazenar informações relacionadas à transação, como identificador da cobrança, valor, método de pagamento, status da transação e informações relacionadas ao plano adquirido.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>4. Compartilhamento de dados</p>
          <p style={{ marginBottom: 6 }}>
            O EI PLACAR não vende, aluga ou comercializa dados pessoais dos usuários.
          </p>
          <p style={{ marginBottom: 6 }}>
            As informações poderão ser compartilhadas com prestadores de serviços e parceiros tecnológicos quando necessário para o funcionamento da plataforma e dos serviços contratados, incluindo serviços de processamento de pagamentos, hospedagem, comunicação e infraestrutura tecnológica.
          </p>
          <p style={{ marginBottom: 10 }}>
            Também poderão ser compartilhadas quando exigido por lei, determinação de autoridade competente ou para cumprimento de obrigações legais.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>5. Segurança</p>
          <p style={{ marginBottom: 6 }}>
            Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados dos usuários contra acesso não autorizado, alteração, divulgação, perda ou destruição.
          </p>
          <p style={{ marginBottom: 10 }}>
            Apesar das medidas de segurança adotadas, nenhum sistema eletrônico pode ser considerado completamente imune a riscos.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>6. Cookies e tecnologias semelhantes</p>
          <p style={{ marginBottom: 10 }}>
            O aplicativo e/ou site poderá utilizar cookies e tecnologias semelhantes para manter funcionalidades, melhorar a experiência do usuário, realizar análises de utilização e aprimorar os serviços oferecidos.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>7. Direitos do usuário</p>
          <p style={{ marginBottom: 10 }}>
            O usuário poderá solicitar, conforme aplicável pela legislação vigente, informações sobre o tratamento de seus dados, bem como a atualização, correção ou exclusão de dados pessoais, observadas as hipóteses em que a legislação permita ou exija sua conservação.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>8. Alterações desta Política</p>
          <p style={{ marginBottom: 6 }}>
            Esta Política de Privacidade poderá ser atualizada a qualquer momento para refletir alterações nos serviços, na legislação ou nas práticas de tratamento de dados.
          </p>
          <p style={{ marginBottom: 10 }}>
            A versão mais recente estará sempre disponível no aplicativo e/ou site do EI PLACAR.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 700, color: 'var(--texto)' }}>9. Contato</p>
          <p>
            Em caso de dúvidas, solicitações ou esclarecimentos relacionados a esta Política de Privacidade e ao tratamento de dados pessoais, o usuário poderá entrar em contato pelos canais oficiais de suporte do EI PLACAR.
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
