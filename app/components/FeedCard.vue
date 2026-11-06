<!--
  One session in the feed: author, date, name, summary (duration, exercises,
  volume, records), photo and the "bravo" button. Tapping the card opens the
  session: the editable page for one's own, the read-only one otherwise.
-->
<script setup lang="ts">
import type { InternalApi } from 'nitropack/types'

/** A feed item, as returned by GET /api/feed. */
type FeedItem = InternalApi['/api/feed']['get']['items'][number]

const props = defineProps<{
  /** The session to show. */
  item: FeedItem
}>()

// Local copies for the like button, which updates them in place.
const likeCount = ref(props.item.likeCount)
const likedByMe = ref(props.item.likedByMe)

const to = computed(() => (props.item.mine ? `/workouts/${props.item.id}` : `/feed/${props.item.id}`))

/** "jeudi 29 octobre · 18:02": the feed is about recent days, the year is noise. */
const when = computed(() => new Date(props.item.startedAt).toLocaleString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
}))
</script>

<template>
  <article class="overflow-hidden rounded-lg border border-default">
    <header class="flex items-center gap-3 px-3 pt-3">
      <!-- Initial in a circle: no profile pictures in this first version. -->
      <NuxtLink
        :to="`/users/${item.username}`"
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary uppercase"
        :aria-label="`Profil de ${item.username}`"
      >
        {{ item.username.charAt(0) }}
      </NuxtLink>
      <div class="min-w-0 flex-1">
        <NuxtLink :to="`/users/${item.username}`" class="font-medium hover:underline">
          {{ item.mine ? 'Vous' : `@${item.username}` }}
        </NuxtLink>
        <p class="text-xs text-muted first-letter:uppercase">
          {{ when }}
        </p>
      </div>
      <UBadge v-if="item.mine && item.visibility === 'private'" color="neutral" variant="subtle" icon="i-lucide-lock" size="sm">
        Privée
      </UBadge>
    </header>

    <NuxtLink :to="to" class="block space-y-2 p-3">
      <p class="text-lg font-semibold">
        {{ item.name ?? 'Séance libre' }}
      </p>
      <dl class="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt class="text-xs text-muted">
            Durée
          </dt>
          <dd class="font-medium tabular-nums">
            {{ item.endedAt ? formatDuration(item.startedAt, item.endedAt) : '–' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Exercices
          </dt>
          <dd class="font-medium tabular-nums">
            {{ item.exerciseCount }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Volume
          </dt>
          <dd class="font-medium tabular-nums">
            {{ formatVolume(item.volumeKg) }}
          </dd>
        </div>
      </dl>
      <UBadge v-if="item.prCount" color="warning" variant="subtle" icon="i-lucide-trophy">
        {{ item.prCount }} record{{ item.prCount > 1 ? 's' : '' }} battu{{ item.prCount > 1 ? 's' : '' }}
      </UBadge>
    </NuxtLink>

    <NuxtLink v-if="item.photoUrl" :to="to" class="block">
      <img :src="item.photoUrl" alt="Photo de la séance" loading="lazy" class="max-h-[28rem] w-full object-cover">
    </NuxtLink>

    <footer class="border-t border-default px-2 py-1">
      <LikeButton v-model:like-count="likeCount" v-model:liked-by-me="likedByMe" :workout-id="item.id" />
    </footer>
  </article>
</template>
