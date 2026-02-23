import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { viteStaticCopy } from 'vite-plugin-static-copy'

/**
 * Vite configuration for LokulMem library
 *
 * Builds dual ESM/CJS output with:
 * - Main library entry (src/index.ts)
 * - Worker entry as separate chunk (src/worker/index.ts)
 * - Automatic type declaration generation via vite-plugin-dts
 * - ORT WASM asset bundling for offline/airgapped deployments
 */
export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      rollupTypes: true,
      insertTypesEntry: true,
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: '.',
        },
        {
          src: 'node_modules/onnxruntime-web/dist/ort-wasm*.mjs',
          dest: '.',
        },
      ],
      silent: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        main: resolve(__dirname, 'src/index.ts'),
        worker: resolve(__dirname, 'src/worker/index.ts'),
      },
      name: 'LokulMem',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      // No external deps in Phase 1; will add runtime deps (dexie, @xenova/transformers) when imported
      external: [],
      output: {
        globals: {},
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wasm')) {
            return '[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
  },
  publicDir: 'public',
  worker: {
    format: 'es',
    plugins: () => [],
  },
})
