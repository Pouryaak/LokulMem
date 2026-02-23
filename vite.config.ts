import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { viteStaticCopy } from 'vite-plugin-static-copy'

/**
 * Vite configuration for LokulMem library
 *
 * Builds dual ESM/CJS output with:
 * - Main library entry (src/index.ts) → dist/main.mjs and dist/main.cjs
 * - Worker entry as separate chunk (src/worker/index.ts) → dist/worker.mjs and dist/worker.cjs
 * - Automatic type declaration generation via vite-plugin-dts
 * - ORT WASM asset bundling for offline/airgapped deployments
 *
 * WORKER BUNDLING STRATEGY:
 * This config uses `build.lib.entry` with multiple entry points (main + worker).
 * This creates separate built files that are loaded at runtime via URL.
 *
 * IMPORTANT: The worker URL in LokulMem.ts uses `new URL('./worker.mjs', import.meta.url).href`
 * to resolve the worker file relative to the main bundle. Do NOT use `?worker&url` import
 * syntax - that creates inline worker bundles which don't work for this library pattern.
 *
 * See: .planning/phases/04-embedding-engine/04-FINAL-SUMMARY.md for details.
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
