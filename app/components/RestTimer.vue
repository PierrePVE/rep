<!--
  Bar of the rest timer, fixed just above the bottom tab bar so it stays in
  view while scrolling through the session. Shows the time left with a
  progress bar, and buttons to add or remove 15 s or to skip the rest. Once
  the rest is over, it vibrates (on phones that allow it), says so for a few
  seconds, then hides itself.

  No props: the state comes from useRestTimer, started by WorkoutExerciseCard.
-->
<script setup lang="ts">
const { endsAt, totalSeconds, add, stop } = useRestTimer()

// How long the "rest is over" message stays before the bar hides.
const DONE_DISPLAY_MS = 5000

// Current time, refreshed while a rest runs. Four ticks a second so the
// display never lags a full second behind after the page wakes up.
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined

/** Starts or stops the ticking with the timer, so an idle page does no work. */
watch(endsAt, (value) => {
  clearInterval(ticker)
  ticker = undefined
  if (value === null) return
  now.value = Date.now()
  ticker = setInterval(() => { now.value = Date.now() }, 250)
}, { immediate: true })

onBeforeUnmount(() => clearInterval(ticker))

/** Whole seconds left, never below 0. */
const remaining = computed(() =>
  endsAt.value === null ? 0 : Math.max(Math.ceil((endsAt.value - now.value) / 1000), 0))

const done = computed(() => endsAt.value !== null && remaining.value === 0)

/** Share of the rest already elapsed, 0 to 100, for the progress bar. */
const progress = computed(() => 100 - Math.min(remaining.value / totalSeconds.value, 1) * 100)

/** Time left as "1:05". */
const display = computed(() => {
  const minutes = Math.floor(remaining.value / 60)
  const seconds = remaining.value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

// When the rest ends: vibrate, then hide the bar after a short while. The
// timeout is cancelled if a new rest starts meanwhile (done goes false).
let hideTimeout: ReturnType<typeof setTimeout> | undefined
watch(done, (isDone) => {
  clearTimeout(hideTimeout)
  if (!isDone) return
  // Not supported everywhere (e.g. iOS Safari): optional chaining keeps it a no-op.
  navigator.vibrate?.([200, 100, 200])
  hideTimeout = setTimeout(stop, DONE_DISPLAY_MS)
})

onBeforeUnmount(() => clearTimeout(hideTimeout))
</script>

<template>
  <!-- Bottom offset = tab bar height + iPhone home-indicator area (see the
       default layout). -->
  <div
    v-if="endsAt !== null"
    class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 px-4 pb-2"
    role="timer"
    aria-live="off"
  >
    <div class="mx-auto max-w-2xl overflow-hidden rounded-lg border border-default bg-elevated shadow-lg">
      <div class="flex items-center gap-2 p-2">
        <UIcon :name="done ? 'i-lucide-bell-ring' : 'i-lucide-timer'" class="size-5 shrink-0" :class="done ? 'text-success' : 'text-primary'" />
        <span class="min-w-0 flex-1 font-medium tabular-nums">
          {{ done ? 'Repos terminé, c\'est reparti !' : `Repos ${display}` }}
        </span>
        <template v-if="!done">
          <UButton label="−15 s" color="neutral" variant="ghost" size="sm" @click="add(-15)" />
          <UButton label="+15 s" color="neutral" variant="ghost" size="sm" @click="add(15)" />
        </template>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="done ? 'Fermer' : 'Passer le repos'"
          @click="stop"
        />
      </div>
      <UProgress :model-value="progress" size="xs" :color="done ? 'success' : 'primary'" />
    </div>
  </div>
</template>
