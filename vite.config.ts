import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Static-host friendly build. No environment variables are required.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
