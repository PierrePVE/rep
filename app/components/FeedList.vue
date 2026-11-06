<!--
  A paginated list of feed cards (GET /api/feed): the whole feed, or one
  user's sessions on their profile. Same "load more" pagination as the
  history page.
-->
<script setup lang="ts">
import type { InternalApi } from 'nitropack/types'

type FeedItem = InternalApi['/api/feed']['get']['items'][number]

const props = defineProps<{
  /** Only this user's sessions; omitted, the whole feed. */
  user?: string
}>()

const PAGE_SIZE = 10

const query = computed(() => ({ limit: PAGE_SIZE, ...(props.user ? { user: props.user } : {}) }))
const { data: firstPage, error } = await useFetch('/api/feed', { query })

const items = ref<FeedItem[]>([])
const nextCursor = ref<number | null>(null)
// Copied into local refs because loadMore() appends to them.
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
    const page = await $fetch('/api/feed', { query: { ...query.value, cursor: nextCursor.value } })
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
</script>

<template>
  <div class="space-y-4">
    <p v-if="error" class="text-error">
      Impossible de charger le feed.
    </p>

    <slot v-else-if="!items.length" name="empty">
      <p class="text-muted">
        Aucune séance à afficher.
      </p>
    </slot>

    <FeedCard v-for="item in items" :key="item.id" :item="item" />

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
