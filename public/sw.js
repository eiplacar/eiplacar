const CACHE = 'ei-placar-v2'; // trocar esse número força uma limpeza de cache em todo mundo, se precisar de novo no futuro
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting(); // ativa a versão nova do SW imediatamente, sem esperar todas as abas fecharem
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim(); // assume o controle das abas já abertas na hora, sem precisar de F5 duas vezes
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Nunca guarda em cache chamadas pra fora (Supabase etc.) — dados sempre vêm da rede/nuvem,
  // isso aqui é só pra deixar o "casco" do app (html/ícones) disponível offline.
  if (url.origin !== location.origin) return;

  // REDE PRIMEIRO: sempre tenta buscar a versão mais nova do servidor. Só usa o
  // que está guardado no aparelho (cache) se a pessoa estiver sem internet —
  // assim ninguém mais fica preso numa versão antiga do app sem perceber.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
