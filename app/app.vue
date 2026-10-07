<!--
  Root component. <UApp> is required by Nuxt UI: it provides the global
  config (toasts, tooltips, overlays) to every component below it.
  <NuxtLayout> wraps each page in layouts/default.vue (bottom tab bar).
-->
<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
