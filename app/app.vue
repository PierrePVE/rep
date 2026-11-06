<!--
  Root component. <UApp> is required by Nuxt UI: it provides the global
  config (toasts, tooltips, overlays) to every component below it.
  <NuxtLayout> wraps each page in layouts/default.vue (bottom tab bar).
-->
<script setup lang="ts">
// The app is French-only: this translates the built-in texts of Nuxt UI
// (close buttons, empty search results...) and makes number fields show
// decimals with a comma ("42,5"), as the rest of the app does.
import { fr } from '@nuxt/ui/locale'
</script>

<template>
  <UApp :locale="fr">
    <!-- Injects the <link rel="manifest"> of the PWA (see `pwa` in nuxt.config). -->
    <NuxtPwaManifest />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
