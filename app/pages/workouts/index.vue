<!--
  Workout history: the finished sessions, newest first, grouped by month.
  Each row shows the date, name, duration, number of exercises and volume,
  and links to the session's detail page. Loads 20 sessions at a time, with a
  "load more" button (cursor pagination, see GET /api/workouts).
-->
<script setup lang="ts">
import type { InternalApi } from 'nitropack/types'

useHead({ title: 'Historique' })

type HistoryItem = InternalApi['/api/workouts']['get']['items'][number]

const PAGE_SIZE = 20

// First page through useFetch so the server renders it. The later pages
// are appended to `items` by loadMore(), outside useFetch.
const { data: firstPage, error } = await useFetch('/api/workouts', { query: { limit: PAGE_SIZE } })

const items = ref<HistoryItem[]>([])
const nextCursor = ref<number | null>(null)

// Copied into local refs (not used directly) because loadMore() appends to
// them; re-run if the first page is refreshed (e.g. on returning to the page).
watch(firstPage, (page) => {
  items.value = page ? [...page.items] : []
  nextCursor.value = page?.nextCursor ?? null
}, { immediate: true })

const loadingMore = ref(false)
const toast = useToast()

/** Appends the next page of sessions. */
async function loadMore() {
  if (nextCursor.value === null) return
  loadingMore.value = true
  try {
    const page = await $fetch('/api/workouts', { query: { limit: PAGE_SIZE, cursor: nextCursor.value } })
    items.value.push(...page.items)
    nextCursor.value = page.nextCursor
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loadingMore.value = false
  }
}

/**
 * Sessions grouped by month, e.g. "novembre 2026". The list is sorted newest
 * first, so a new group starts whenever the month changes.
 */
const months = computed(() => {
  const groups: Array<{ label: string, items: HistoryItem[] }> = []
  for (const item of items.value) {
    const label = new Date(item.startedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const group = groups.at(-1)
    if (group?.label === label) group.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
})
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">
      Historique
    </h1>

    <p v-if="error" class="text-error">
      Impossible de charger l'historique.
    </p>

    <p v-else-if="!items.length" class="text-muted">
      Aucune séance terminée pour l'instant.
    </p>

    <section v-for="month in months" :key="month.label" class="space-y-2">
      <h2 class="text-sm font-medium text-muted first-letter:uppercase">
        {{ month.label }}
      </h2>
      <ul class="divide-y divide-default rounded-lg border border-default">
        <li v-for="item in month.items" :key="item.id">
          <NuxtLink :to="`/workouts/${item.id}`" class="flex items-center gap-3 p-3">
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">
                {{ item.name ?? 'Séance libre' }}
              </p>
              <p class="text-sm text-muted">
                {{ formatDay(item.startedAt) }}
                <!-- endedAt is never null here: the API only lists finished sessions. -->
                <template v-if="item.endedAt">
                  · {{ formatDuration(item.startedAt, item.endedAt) }}
                </template>
                · {{ item.exerciseCount }} exercice{{ item.exerciseCount > 1 ? 's' : '' }}
              </p>
            </div>
            <span class="text-sm font-medium tabular-nums">{{ formatVolume(item.volumeKg) }}</span>
            <UIcon name="i-lucide-chevron-right" class="size-5 text-muted" />
          </NuxtLink>
        </li>
      </ul>
    </section>

    <UButton
      v-if="nextCursor !== null"
      label="Voir les séances précédentes"
      color="neutral"
      variant="subtle"
      block
      :loading="loadingMore"
      @click="loadMore"
    />
  </div>
</template>
