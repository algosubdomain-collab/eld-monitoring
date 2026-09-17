import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../public', emptyOutDir: true },
  server: {
    port: 5174,
    // Bir tarmoqdagi boshqa qurilmalar ham ocha olsin.
    host: true,
    // Dev rejimida API so'rovlari Node serverga yo'naltiriladi.
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3000}` },
  },
});
