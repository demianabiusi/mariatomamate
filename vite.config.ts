import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const buildDate = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  base: './',
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
