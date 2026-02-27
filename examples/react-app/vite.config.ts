import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 3001,
    open: true,
    fs: {
      // Allow serving files from the lokulmem project root
      allow: [
        // Allow the React app directory
        path.resolve(__dirname, '.'),
        // Allow the lokulmem library directory (parent of parent)
        path.resolve(__dirname, '../..')
      ]
    }
  },
  build: {
    outDir: 'dist'
  },
  optimizeDeps: {
    exclude: ['@lokul/lokulmem'],
  }
});
