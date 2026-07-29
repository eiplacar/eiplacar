import { Lightbulb } from 'lucide-react';

// ══ Estratégias — página nova, estrutura inicial ══
// Ainda sem conteúdo definido — só a base pronta (título, ícone, card vazio)
// pra ir preenchendo aos poucos depois.

export default function Estrategias() {
  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lightbulb size={14} /> Estratégias
      </div>
      <div className="empty">
        <div className="icon"><Lightbulb size={24} /></div>
        <p>Em breve, dicas e estratégias de análise por aqui.</p>
      </div>
    </div>
  );
}
