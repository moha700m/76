import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@appdeploy/client': fileURLToPath(new URL('./src/platform/appdeploy-client-vercel.ts', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      maxParallelFileOps: 128,
    },
  },
});
