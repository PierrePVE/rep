<!--
  Read-only detail of a session from the feed: author, summary, photo, the
  exercises with their sets, and the "bravo" button. One's own sessions are
  sent to their editable page instead.
-->
<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)

const { data, error } = await useFetch(`/api/feed/${id}`)

// The owner edits their session on the history page, which has everything.
if (data.value?.mine) await navigateTo(`/workouts/${id}`, { replace: true })

useHead({ title: () => data.value?.workout.name ?? 'Séance' })

// Local copies for the like button, which updates them in place.
const likeCount = ref(0)
const likedByMe = ref(false)
watch(data, (value) => {
  likeCount.value = value?.likeCount ?? 0
  likedByMe.value = value?.likedByMe ?? false
}, { immediate: true })

/** Volume without warm-ups, as everywhere else. */
const volumeKg = computed(() => (data.value?.workout.exercises ?? [])
  .flatMap(e => e.sets)
  .filter(s => s.type !== 'warmup')
  .reduce((total, s) => total + s.weightKg * s.reps, 0))
</script>

<template>
  <div class="space-y-4">
    <UButton to="/feed" icon="i-lucide-arrow-left" label="Feed" color="neutral" variant="link" class="px-0" />

    <!-- A private session and a missing one get the same 404 from the API. -->
    <p v-if="error || !data" class="text-error">
      {{ error?.statusCode === 404 ? 'Séance introuvable.' : 'Impossible de charger la séance.' }}
    </p>

    <template v-else>
      <div>
        <NuxtLink :to="`/users/${data.username}`" class="text-sm font-medium text-primary hover:underline">
          @{{ data.username }}
        </NuxtLink>
        <h1 class="text-2xl font-bold">
          {{ data.workout.name ?? 'Séance libre' }}
        </h1>
        <p class="text-sm text-muted first-letter:uppercase">
          {{ formatDay(data.workout.startedAt) }}
          <template v-if="data.workout.endedAt">
            · {{ formatDuration(data.workout.startedAt, data.workout.endedAt) }}
          </template>
          · Volume {{ formatVolume(volumeKg) }}
        </p>
      </div>

      <img v-if="data.workout.photoUrl" :src="data.workout.photoUrl" alt="Photo de la séance" class="max-h-[28rem] w-full rounded-lg object-cover">

      <LikeButton v-model:like-count="likeCount" v-model:liked-by-me="likedByMe" :workout-id="id" />

      <p v-if="!data.workout.exercises.length" class="text-muted">
        Aucun exercice dans cette séance.
      </p>

      <section v-for="item in data.workout.exercises" :key="item.id" class="rounded-lg border border-default">
        <h2 class="border-b border-default px-3 py-2 font-medium">
          {{ item.exercise.name }}
        </h2>
        <p v-if="!item.sets.length" class="p-3 text-sm text-muted">
          Aucune série.
        </p>
        <ol v-else class="divide-y divide-default text-sm">
          <li v-for="(set, index) in item.sets" :key="set.id" class="flex items-center gap-3 px-3 py-2">
            <span class="w-5 text-muted tabular-nums">{{ index + 1 }}</span>
            <span class="flex-1 font-medium tabular-nums">
              {{ formatWeight(set.weightKg) }} × {{ set.reps }}
              <span v-if="set.rpe" class="font-normal text-muted">· RPE {{ set.rpe }}</span>
            </span>
            <UBadge v-if="SET_TYPE_LABELS[set.type]" color="neutral" variant="subtle" size="sm">
              {{ SET_TYPE_LABELS[set.type] }}
            </UBadge>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
