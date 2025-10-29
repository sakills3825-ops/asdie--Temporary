import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  
  // 환경 변수 로드
  // .env.{NODE_ENV}에서 VITE_* 변수 자동 로드
  envPrefix: 'VITE_',
  
  server: {
    port: 5173,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
  
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/preload/index.ts'),
      name: 'PreloadAPI',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    outDir: path.resolve(__dirname, 'dist'),
    rollupOptions: {
      external: ['electron'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },
});
