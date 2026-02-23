import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration for LokulMem testing
 *
 * Provides:
 * - happy-dom environment for DOM mocking in Node.js
 * - Global test APIs enabled
 * - Unit test file patterns
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'examples'],
  },
})
