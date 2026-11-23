import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
  // The Excel export library (~950 kB) is its own chunk, loaded only when exporting.
  build: { chunkSizeWarningLimit: 1100 },
});
