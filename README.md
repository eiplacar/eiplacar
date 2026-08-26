# Ei Placar

App de análise de jogos, calculadora de entradas e gestão de banca, com dados
sincronizados na nuvem via Supabase e deploy no Netlify.

Este é o antigo "Meu Placar" reorganizado: estrutura de projeto padrão (Vite),
publicável no Netlify, com a interface **já migrada para React** — a lógica de
cálculo/negócio mais pesada (Poisson, força do adversário, classificação,
banca) continua em JS puro por trás, chamada pelos componentes React através
de pontes explícitas (`window.algumaFuncao`).

## Estrutura de pastas

```
ei-placar/
├── index.html            → página principal (carrega os scripts + o bundle React)
├── src/                   → interface em React
│   ├── main.jsx           → monta cada componente na sua <div id="...-root">
│   └── components/
│       ├── Dashboard.jsx          → aba inicial (campeonatos, resumo, Jogos de Hoje)
│       ├── ListaPartidas.jsx      → aba Dados (tabela "Lista de Partidas")
│       ├── SeletorAnalise.jsx     → aba Análise (escolha de campeonato/confronto)
│       ├── AnaliseResultado.jsx   → aba Análise (resultado: Probabilidade/Estatísticas/Índice)
│       ├── Estatistica.jsx        → sub-aba Estatística por liga
│       ├── Classificacao.jsx      → sub-aba Classificação (tabela de pontos corridos)
│       ├── AdicionarPartida.jsx   → aba Partidas (cadastro de jogo)
│       ├── NovoSinalEntrada.jsx   → sub-aba dentro de Partidas (Novo Sinal de Entrada)
│       ├── NovaEntrada.jsx        → aba Apostas (nova entrada)
│       ├── Resolvidas.jsx         → aba Apostas (histórico de entradas resolvidas)
│       ├── Estrategias.jsx        → aba Apostas (estratégias cadastradas)
│       ├── SeletorMercado.jsx     → sub-componente de mercado (usado em Nova Entrada)
│       ├── Banca.jsx              → aba Banca (tesouraria, membros)
│       ├── Administracao.jsx      → aba Administração (só organizador: usuários, planos)
│       └── MinhaConta.jsx         → tela de conta do usuário logado
├── public/                → tudo que é servido "como está" (sem processamento)
│   ├── manifest.json      → configuração do PWA (nome, ícones, cores)
│   ├── sw.js               → service worker (cache offline do "casco" do app)
│   ├── styles.css          → estilos (compartilhado entre JS puro e React)
│   ├── icon-*.png          → ícones do app
│   └── js/                  → scripts JS puro, em ordem de carregamento (regra de negócio,
│       │                       Supabase, e as pontes `window.*` usadas pelo React):
│       01-config-auth.js    → conexão com Supabase + login/cadastro/sessão
│       02-dados-crud.js     → leitura/escrita dos jogos no Supabase
│       03-nav.js            → navegação entre abas
│       04-utils.js          → funções utilitárias
│       05-escudos.js        → upload/exibição de escudos dos times
│       06-confrontos.js     → salvar jogo (usado por AdicionarPartida.jsx)
│       07-geral.js          → cálculo do Dashboard (campeonatos, resumo, últimos resultados)
│       08-dados-render.js   → filtros/paginação da Lista de Partidas
│       09-analise.js        → cálculo da Análise (Poisson, força do adversário etc.)
│       10-compartilhar.js   → geração de texto/imagem pra WhatsApp/Telegram
│       11-jogosdodia.js     → lista "Jogos de Hoje" (Dashboard)
│       12-banca-futebol.js  → cálculo de Estatística + Classificação + banca (futebol)
│       13-calculadora.js    → cálculo de EV/estatística por liga (Apostas)
│       14-banca-gestao.js   → membros, tesouraria, organizador, aprovações
│       15-init.js           → inicialização geral da página
│       16-admin.js          → Administração: usuários, assinaturas, config do app (planos/preços)
│       17-indice.js         → sub-aba Índice (Favorita Ponto), cruza Probabilidade + Estatísticas
├── netlify/functions/     → funções serverless (rodam no servidor da Netlify)
│   ├── jogos-do-dia.js               → busca jogos do dia na GOAL API (chamada sob demanda pelo app)
│   └── atualizar-jogos-finalizados.js → roda a cada 2h (agendada), busca jogos finalizados e salva no Supabase
├── supabase/               → scripts SQL do banco (rodar no SQL Editor, em ordem)
├── vite.config.js          → configuração do bundler/dev-server (Vite + plugin React)
├── netlify.toml             → configuração de build/deploy no Netlify
└── package.json
```

## Rodando localmente

Pré-requisito: Node.js já instalado.

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

## Funções serverless (Netlify Functions)

Ficam em `netlify/functions/` e rodam no servidor, não no navegador — assim a
chave da GOAL API (`GOAL_API_KEY`) fica escondida como variável de ambiente no
painel da Netlify, e nunca é exposta no código do navegador.

- **`jogos-do-dia.js`** — busca os jogos do dia na GOAL API sob demanda
  (`/.netlify/functions/jogos-do-dia?data=AAAA-MM-DD`).
- **`atualizar-jogos-finalizados.js`** — agendada (`schedule` no `netlify.toml`,
  roda a cada 2 horas), busca jogos finalizados de hoje/ontem nas ligas
  permitidas e salva no Supabase. Aceita jogo decidido em `FINISHED`,
  `AFTER_ET` (prorrogação) e `AFTER_PEN` (pênaltis) como encerrado.

> As funções `buscar-liga-id` e `goal-webhook` (e o arquivo `public/js/18-ao-vivo.js`,
> que alimentava o card "Ao Vivo" no Dashboard) foram removidas — não fazem
> mais parte do projeto.

## Como JS puro e React convivem

Cada tela vira um componente dentro de `src/components/`, montado pelo
`src/main.jsx` numa `<div id="algo-root">` que fica exatamente onde o card em
JS puro ficava antes, dentro da mesma aba/navegação de sempre.

Quando um componente React precisa de algo que ainda vive no mundo JS puro
(cálculo pesado, variável global, uma função como `toast()`), a ponte é
sempre explícita e comentada no código — por exemplo, `AnaliseResultado.jsx`
chama `window.renderAnalise()` (que faz todo o cálculo de Poisson em
`09-analise.js`) e só cuida de exibir o resultado.

### Ícones

Os componentes React usam ícones de verdade da biblioteca
[lucide-react](https://lucide.dev) em vez de emoji. O que ainda é JS puro
continua usando emoji.
