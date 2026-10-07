// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils', '@vite-pwa/nuxt'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // Server-only values. Each key is overridden at runtime by its NUXT_* env
  // variable (databaseUrl <- NUXT_DATABASE_URL), so no secret lives in code.
  runtimeConfig: {
    databaseUrl: '',
  },
  compatibilityDate: '2025-07-15',
  typescript: {
    // Root-level tooling files (drizzle-kit config) run in plain Node, outside
    // Nuxt. Without this they belong to no tsconfig, so the editor reports
    // "Cannot find name 'process'" and `nuxi typecheck` silently skips them.
    nodeTsConfig: {
      include: ['../drizzle.config.ts'],
      compilerOptions: { types: ['node'] },
    },
  },
})
