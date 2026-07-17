import { defineConfig } from 'vitest/config'
import path from 'path'

// Unit-test config for the pure, money/compliance-critical computation
// functions (see AUDIT_2026-07-10.md's testing gap). Deliberately scoped
// to node-environment unit tests only — no jsdom, no component rendering.
// Server actions and DB-touching code stay out of scope here; what's
// covered is the pure computation extracted out of them (see e.g.
// lib/activate-subscription.ts's computeSubscriptionUpdate).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
})
