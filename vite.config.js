import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuração do projeto em transição: HTML + JS puro (scripts globais) convivendo
// com os primeiros componentes React, montados dentro de <div id="...-root">
// específicos, dentro das mesmas páginas de sempre.
//
// O restante do app continua igual: nada muda nos <script src="js/..."> do
// index.html. Só os módulos novos entram por /src, compilados pelo plugin React.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    open: false
  }
});
