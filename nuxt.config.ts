// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils', '@vite-pwa/nuxt'],
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      // Each page sets its title with useHead(), rendered as "Accueil | Rep".
      // Must be a string here: nuxt.config is serialized, so no functions.
      titleTemplate: '%s | Rep',
      meta: [
        // viewport-fit=cover lets the page extend under the iPhone notch and
        // home indicator, which is what makes env(safe-area-inset-*) non-zero.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        // Color of the browser / system bars around the page, per color mode
        // (the manifest's theme_color can only hold one).
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#0f172a' },
        // iOS ignores most of the manifest: these make the app installed from
        // Safari ("Add to Home Screen") open full screen, with its name. The
        // translucent status bar draws the page under it, which the layout's
        // safe-area padding already accounts for.
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Rep' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        // SVG first: sharp at any size in current browsers. The .ico (16, 32
        // and 48 px renders of the same dumbbell) is the fallback for the rest.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        // Home screen icon of iOS, which does not read the manifest icons.
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
    },
  },
  // Installable app (PWA): web manifest and service worker. The PNG icons are
  // generated from favicon.svg by `npm run pwa:icons` (pwa-assets.config.ts).
  pwa: {
    // A new version is installed in the background and used on the next
    // launch: there is no client-side data that an update could lose.
    registerType: 'autoUpdate',
    manifest: {
      name: 'Rep : suivi de musculation',
      short_name: 'Rep',
      description: 'Carnet de musculation : séances, séries, records et progression.',
      lang: 'fr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      // Splash screen and title bar while the app starts: the dark theme.
      background_color: '#0f172a',
      theme_color: '#0f172a',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Only the build's static files are cached (JS, CSS, icons, fonts), so
      // the app shell loads instantly and survives a bad gym network. Pages
      // are rendered on the server with the user's data, and /api answers
      // are personal and must be fresh: neither is cached. Offline logging
      // is a V2 feature (see PRODUCT.md).
      globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
      navigateFallback: null,
      cleanupOutdatedCaches: true,
    },
    client: {
      // No "install the app?" banner of our own: the browser's menu is enough.
      installPrompt: false,
    },
    // No service worker in `nuxt dev`: it would cache files that change on
    // every edit. Test it with `npm run build` + `npm run preview`.
    devOptions: { enabled: false },
  },
  css: ['~/assets/css/main.css'],
  // Server-only values. Each key is overridden at runtime by its NUXT_* env
  // variable (databaseUrl <- NUXT_DATABASE_URL), so no secret lives in code.
  runtimeConfig: {
    databaseUrl: '',
    // nuxt-auth-utils cookie. Without maxAge it would be a browser-session
    // cookie, dropped when the browser (or the installed PWA) is closed.
    // 30 days = SESSION_DURATION_MS in server/utils/session.ts.
    session: {
      // Required by the type; the real value comes from NUXT_SESSION_PASSWORD.
      password: '',
      maxAge: 60 * 60 * 24 * 30,
    },
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
