<!--
  Default layout: page content plus a fixed bottom tab bar, mobile-app style.
  Every page renders inside <slot />.
-->
<script setup lang="ts">
/** One entry of the bottom tab bar. */
interface Tab {
  /** Route the tab links to. */
  to: string
  /** Label shown under the icon (UI text, in French). */
  label: string
  /** Iconify name from the bundled Lucide set. */
  icon: string
}

const tabs: Tab[] = [
  { to: '/', label: 'Accueil', icon: 'i-lucide-house' },
  { to: '/workouts/current', label: 'Séance', icon: 'i-lucide-dumbbell' },
  { to: '/workouts', label: 'Historique', icon: 'i-lucide-calendar-days' },
  { to: '/exercises', label: 'Exercices', icon: 'i-lucide-list' },
]

const route = useRoute()

/**
 * Route of the tab to highlight.
 * We don't rely on NuxtLink's active classes: "/" is a prefix of every path,
 * and "/workouts" is a prefix of "/workouts/current", so several tabs would
 * light up at once. Instead the longest tab route that prefixes the current
 * path wins (so "/workouts/42" still highlights "Historique").
 */
const activeTab = computed(() => {
  const path = route.path
  const matches = tabs.filter(tab =>
    tab.to === '/' ? path === '/' : path === tab.to || path.startsWith(`${tab.to}/`),
  )
  return matches.sort((a, b) => b.to.length - a.to.length)[0]?.to
})
</script>

<template>
  <div class="min-h-dvh bg-default">
    <!-- Bottom padding = bar height + iPhone home-indicator area, so the end
         of the page never hides behind the fixed bar. -->
    <main class="mx-auto max-w-2xl px-4 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-10 border-t border-default bg-default/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Navigation principale"
    >
      <ul class="mx-auto grid h-16 max-w-2xl grid-cols-4">
        <li v-for="tab in tabs" :key="tab.to">
          <!-- Full-height cell keeps the touch target well above 44px. -->
          <NuxtLink
            :to="tab.to"
            class="flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors"
            :class="activeTab === tab.to ? 'text-primary' : 'text-muted hover:text-default'"
            :aria-current="activeTab === tab.to ? 'page' : undefined"
          >
            <UIcon :name="tab.icon" class="size-6" />
            {{ tab.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
