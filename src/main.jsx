import { createRoot } from 'react-dom/client';
import Dashboard from './components/Dashboard.jsx';
import CalculadoraEV from './components/CalculadoraEV.jsx';
import ListaPartidas from './components/ListaPartidas.jsx';
import SeletorAnalise from './components/SeletorAnalise.jsx';
import AnaliseResultado from './components/AnaliseResultado.jsx';
import Estatistica from './components/Estatistica.jsx';
import Classificacao from './components/Classificacao.jsx';
import MinhaConta from './components/MinhaConta.jsx';
import Administracao from './components/Administracao.jsx';
import Banca from './components/Banca.jsx';
import Resolvidas from './components/Resolvidas.jsx';
import AdicionarPartida from './components/AdicionarPartida.jsx';
import NovoSinalEntrada from './components/NovoSinalEntrada.jsx';
import NovaEntrada from './components/NovaEntrada.jsx';

// Cada componente React migrado ganha uma <div id="...-root"> própria,
// no lugar exato onde o card em JS puro ficava antes. O resto do app
// (navegação entre abas, Supabase, etc.) continua sendo JS puro e nem
// percebe que aquele pedaço agora é React.
const dashboardRoot = document.getElementById('dashboard-root');
if (dashboardRoot) {
  createRoot(dashboardRoot).render(<Dashboard />);
}

const calcRoot = document.getElementById('calc-root');
if (calcRoot) {
  createRoot(calcRoot).render(<CalculadoraEV />);
}

const dadosRoot = document.getElementById('dados-root');
if (dadosRoot) {
  createRoot(dadosRoot).render(<ListaPartidas />);
}

const analiseRoot = document.getElementById('analise-root');
if (analiseRoot) {
  createRoot(analiseRoot).render(<SeletorAnalise />);
}

const analiseResultadoRoot = document.getElementById('analise-resultado-root');
if (analiseResultadoRoot) {
  createRoot(analiseResultadoRoot).render(<AnaliseResultado />);
}

const estatisticaRoot = document.getElementById('estatistica-root');
if (estatisticaRoot) {
  createRoot(estatisticaRoot).render(<Estatistica />);
}

const classificacaoRoot = document.getElementById('classificacao-root');
if (classificacaoRoot) {
  createRoot(classificacaoRoot).render(<Classificacao />);
}

const minhaContaRoot = document.getElementById('minhaconta-root');
if (minhaContaRoot) {
  createRoot(minhaContaRoot).render(<MinhaConta />);
}

const administracaoRoot = document.getElementById('administracao-root');
if (administracaoRoot) {
  createRoot(administracaoRoot).render(<Administracao />);
}

const bancaRoot = document.getElementById('banca-root');
if (bancaRoot) {
  createRoot(bancaRoot).render(<Banca />);
}

const resolvidasRoot = document.getElementById('resolvidas-root');
if (resolvidasRoot) {
  createRoot(resolvidasRoot).render(<Resolvidas />);
}

const confrontosRoot = document.getElementById('confrontos-root');
if (confrontosRoot) {
  createRoot(confrontosRoot).render(<AdicionarPartida />);
}

const sinalRoot = document.getElementById('sinal-root');
if (sinalRoot) {
  createRoot(sinalRoot).render(<NovoSinalEntrada />);
}

const novaEntradaRoot = document.getElementById('nova-entrada-root');
if (novaEntradaRoot) {
  createRoot(novaEntradaRoot).render(<NovaEntrada />);
}
