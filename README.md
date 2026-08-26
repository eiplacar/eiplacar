# Ei Placar

App de análise de jogos, calculadora de entradas e gestão de banca, com dados
sincronizados na nuvem via Supabase e deploy no Netlify.

Este é o antigo "Meu Placar" reorganizado: mesmo código (HTML + JS puro,
funcional), dentro de uma estrutura de projeto padrão (Vite), publicável no
Netlify, e agora **em migração módulo por módulo para React** — sem parar o
app pra reescrever tudo de uma vez. O JS puro e os componentes React
convivem lado a lado até a migração terminar.

## Estrutura de pastas

```
ei-placar/
├── index.html          → página principal (carrega os scripts + o bundle React)
├── src/                  → componentes React (migração em andamento)
│   ├── main.jsx          → monta cada componente na sua <div id="...-root">
│   └── components/
│       └── CalculadoraEV.jsx   → ✅ migrado (aba Calculadora)
├── public/              → tudo que é servido "como está" (sem processamento)
│   ├── manifest.json    → configuração do PWA (nome, ícones, cores)
│   ├── sw.js            → service worker (cache offline do "casco" do app)
│   ├── styles.css       → estilos (compartilhado entre JS puro e React)
│   ├── icon-*.png       → ícones do app
│   └── js/               → scripts que ainda são JS puro, em ordem de carregamento:
│       01-config-auth.js    → conexão com Supabase + login/cadastro/sessão
│       02-dados-crud.js     → leitura/escrita dos jogos no Supabase
│       03-nav.js            → navegação entre abas
│       04-utils.js          → funções utilitárias
│       05-escudos.js        → upload/exibição de escudos dos times
│       06-confrontos.js     → tela de cadastro de jogos (Partidas)
│       07-geral.js          → aba "Dashboard" (campeonatos e resumo)
│       08-dados-render.js   → tabela "Lista de Partidas"
│       09-analise.js        → aba "Análise" (comparação de times)
│       10-compartilhar.js   → geração de texto/imagem pra WhatsApp/Telegram
│       11-jogosdodia.js     → sub-aba "Novo Sinal de Entrada" (dentro de Partidas) + lista "Jogos de Hoje" (Dashboard)
│       12-banca-futebol.js  → Estatística + Classificação
│       13-calculadora.js    → aba "Apostas" (Entrada, Resolvidas)
│       14-banca-gestao.js   → membros, tesouraria, organizador, aprovações
│       15-init.js           → inicialização geral da página
├── supabase/             → scripts SQL do banco (rodar no SQL Editor, em ordem)
├── vite.config.js        → configuração do bundler/dev-server (Vite + plugin React)
├── netlify.toml           → configuração de build/deploy no Netlify
└── package.json
```

## Rodando localmente

Pré-requisito: Node.js já instalado (você confirmou que tem).

```bash
cd ei-placar
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente `http://localhost:5173`).
O app já vem conectado ao mesmo projeto Supabase que você já usava (a URL e a
chave anônima estão em `public/js/01-config-auth.js`) — não precisa configurar
nada pra já ver os dados.

Para simular o build de produção (o que o Netlify vai gerar):

```bash
npm run build
npm run preview
```

## Banco de dados (Supabase)

As tabelas já existem no seu projeto Supabase atual e continuam funcionando
sem mudanças. Os arquivos em `supabase/` ficam aqui só como referência /
histórico de setup — veja `supabase/00-LEIA-ME.txt` para a ordem de execução
caso precise recriar o banco do zero (ex: novo ambiente).

## Deploy no Netlify

1. Suba esta pasta num repositório Git (GitHub/GitLab/Bitbucket).
2. No Netlify: **Add new site → Import an existing project**.
3. Build command: `npm run build` · Publish directory: `dist`
   (o `netlify.toml` já deixa isso configurado automaticamente).
4. Deploy.

## Como JS puro e React convivem

Cada tela migrada vira um componente dentro de `src/components/`, montado
pelo `src/main.jsx` numa `<div id="algo-root">` que fica exatamente onde o
card em JS puro ficava antes, dentro da mesma aba/navegação de sempre. O
resto do app (login, Supabase, troca de abas) nem percebe a diferença.

Quando um componente React precisa de algo que ainda vive no mundo JS puro
(uma variável global, uma função como `toast()`), a ponte é sempre explícita
e comentada no código — por exemplo, a Calculadora de EV lê
`window.ultimaAnalise` (preenchido pela aba Análise) e chama `window.toast()`
pros avisos.

## Progresso da migração para React

- [x] **Calculadora de EV** (aba Calculadora) → `src/components/CalculadoraEV.jsx`
- [x] **Lista de Partidas** (aba Dados) → `src/components/ListaPartidas.jsx`
- [x] **Seletor da Análise** (Campeonato + Confronto) → `src/components/SeletorAnalise.jsx`
      — o cálculo de estatísticas em si (`renderAnalise`, Poisson, força do adversário
      etc., ~350 linhas de matemática) continua JS puro por enquanto, chamado pela
      ponte `window.renderAnalise()`. Pode virar React depois, com mais calma.
- [x] **Adicionar Partida** (aba Partidas) → `src/components/AdicionarPartida.jsx`
      — migração "de organização": o HTML virou componente React com os mesmos ids
      de sempre, mas os campos continuam não-controlados e chamam as mesmas funções
      JS puras (upload de escudo com canvas, gols por minuto, salvar jogo). Entrelaçado
      demais com o resto do app pra arriscar reescrever a lógica agora também.
- [x] **Novo Sinal de Entrada** (sub-aba dentro de Partidas) → `src/components/NovoSinalEntrada.jsx`
      — migração completa, com estado 100% React (não é só um "shell" como Adicionar
      Partida). A lista "Jogos de Hoje" (localStorage + expiração automática, usada
      também no Dashboard) continua JS puro em `11-jogosdodia.js`.
- [x] **Nova Entrada** (aba Apostas) → `src/components/NovaEntrada.jsx`
      — migração "de organização" como Adicionar Partida: entrelaçada demais com a
      Banca (distribuição de lucro por participante, modal de confirmação) pra
      reescrever a lógica agora. Ícones trocados por Lucide mesmo assim.
- [ ] **Resolvidas** (histórico de entradas, aba Apostas) — fica junto com Banca,
      já que `renderHistoricoEntradas()` também alimenta um painel dentro da Banca
- [ ] **Estatística + Classificação** (`12-banca-futebol.js`, exceto a parte de banca) ← **próximo módulo**
- [ ] **Dashboard** (`07-geral.js`)
- [ ] **Banca** (`14-banca-gestao.js` + parte de banca de `12-banca-futebol.js`) — deixado por último de propósito: vai passar por reformulação antes de virar componente
- [ ] `01-config-auth.js` + `02-dados-crud.js` — sempre por último, pois tudo depende deles

### Ícones

A partir do módulo "Novo Sinal de Entrada", os componentes React usam ícones de
verdade da biblioteca [lucide-react](https://lucide.dev) em vez de emoji. Os
componentes migrados antes desse ponto (Calculadora, Lista de Partidas, Seletor de
Análise, Adicionar Partida) também já foram atualizados. O que ainda é JS puro
continua usando emoji por enquanto — vai sendo trocado por ícones conforme cada
tela for migrada.

Sem pressa: migramos um módulo por vez, testamos, e só então seguimos pro
próximo.
