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
})
