import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isVercelBuild = process.env.VERCEL === '1';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: isVercelBuild
      ? { '@appdeploy/client': fileURLToPath(new URL('./src/platform/appdeploy-client-vercel.ts', import.meta.url)) }
      : {},
  },
  build: {
    rollupOptions: {
      maxParallelFileOps: 128,
    },
  },
});
