<!--
  Default layout: a top bar with the account menu, the page content, and a
  fixed bottom tab bar, mobile-app style. Every page renders inside <slot />.
-->
<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { user, clear } = useUserSession()

/** Logs out (the server-side hook also deletes the DB session) and leaves. */
async function logout() {
  await clear()
  await navigateTo('/login')
}

/** Account menu: who is logged in, admin link for the admin, logout. */
const accountItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [
    ...(user.value?.role === 'admin'
      ? [{ label: 'Administration', icon: 'i-lucide-shield', to: '/admin' }]
      : []),
    { label: 'Se déconnecter', icon: 'i-lucide-log-out', onSelect: logout },
  ],
])

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
    <!-- Top padding = iPhone notch area (viewport-fit=cover lets the page go under it). -->
    <header class="sticky top-0 z-10 border-b border-default bg-default/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div class="mx-auto flex h-12 max-w-2xl items-center justify-between px-4">
        <div class="flex items-center gap-2">
          <span class="font-bold">Rep</span>
          <!-- Tells portfolio visitors they are on the shared demo account. -->
          <UBadge v-if="user?.role === 'demo'" color="warning" variant="subtle" size="sm">
            Démo
          </UBadge>
        </div>
        <UDropdownMenu :items="accountItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" icon="i-lucide-circle-user" aria-label="Mon compte" />
        </UDropdownMenu>
      </div>
    </header>

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
