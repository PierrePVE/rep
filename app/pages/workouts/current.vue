<!--
  Current workout: the main logging screen. Without a session in progress, it
  offers to start one (a day of the active program, the next day of the
  rotation being highlighted, or a free session); with
  one, it shows its exercises and sets, lets the user add exercises outside
  the plan, and finish it (then opens its summary, where a photo can be
  added). A rest timer (which the user can turn off) runs
  after each logged set.
-->
<script setup lang="ts">
useHead({ title: 'Séance en cours' })

const currentWorkout = useCurrentWorkout()
const { workout, load, start, finish, addExercise } = currentWorkout
const requestFetch = useRequestFetch()

// Through useAsyncData rather than a bare `await load()`: on the first visit
// the server loads the session and the browser reuses that result (useState
// carries it over) instead of fetching it a second time while hydrating.
// On later client-side visits it reloads, so a session started or finished on
// another device shows up.
const { error } = await useAsyncData('current-workout', async () => {
  await load()
  return true
})

// Only needed on the start screen. `watch` reloads it when the session is
// finished, since the page then switches back to that screen.
// The suggested day comes from the server, which knows the last session done.
const { data: activeProgram } = await useAsyncData(
  'active-program-days',
  async () => (workout.value === null ? (await requestFetch('/api/active-program')).program : null),
  { watch: [() => workout.value === null] },
)

// Which start button shows the spinner: the day id, or 'free'.
const starting = ref<number | 'free' | null>(null)

/**
 * Starts a session from a program day, or a free one.
 *
 * @param programDayId - Day to prefill from; omitted for a free session.
 */
async function onStart(programDayId?: number) {
  starting.value = programDayId ?? 'free'
  await start(programDayId)
  starting.value = null
}

/** Session title: the program day's name, or a generic one for a free session. */
const title = computed(() => workout.value?.name ?? 'Séance libre')

/** Start time, e.g. "10:24", to show how long the session has been going. */
const startedAt = computed(() => workout.value
  ? new Date(workout.value.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  : '')

type PlanEntry = NonNullable<typeof workout.value>['plan'][number]

/**
 * Finds the program targets of an exercise of the session. Matched by
 * exercise, since a workout exercise keeps no link to the planned one (see
 * loadWorkout).
 *
 * @param exerciseId - Exercise of the catalogue.
 * @returns The targets, or undefined for an exercise added outside the plan.
 */
function planFor(exerciseId: number): PlanEntry | undefined {
  return workout.value?.plan.find(p => p.exerciseId === exerciseId)
}

// --- Rest timer ---

const restTimer = useRestTimer()
// The saved on/off choice lives in localStorage, only readable in the browser.
onMounted(restTimer.restoreSetting)

// --- Adding an exercise ---

const addOpen = ref(false)

// Finishing is a two-step click, as for deletions elsewhere: a stray tap must
// not close the session in the middle of training.
const finishArmed = ref(false)
const finishing = ref(false)
const toast = useToast()

/** Handles a click on the finish button: arms it, or ends the session. */
async function onFinish() {
  if (!finishArmed.value) {
    finishArmed.value = true
    return
  }
  finishArmed.value = false
  finishing.value = true
  // Read before finish(), which clears the state.
  const finishedId = workout.value?.id
  if (await finish()) {
    // A rest still running would otherwise show up again in the next session.
    restTimer.stop()
    toast.add({ title: 'Séance terminée', color: 'success' })
    // Straight to the summary, Strava-style: that is where the photo is added.
    if (finishedId) await navigateTo(`/workouts/${finishedId}`)
  }
  finishing.value = false
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="error" class="text-error">
      Impossible de charger la séance.
    </p>

    <!-- No session in progress: the start screen. -->
    <template v-else-if="workout === null">
      <h1 class="text-2xl font-bold">
        Nouvelle séance
      </h1>

      <section v-if="activeProgram?.days.length" class="space-y-2">
        <h2 class="text-sm font-medium text-muted">
          {{ activeProgram.name }}
        </h2>
        <ul class="divide-y divide-default rounded-lg border border-default">
          <li v-for="day in activeProgram.days" :key="day.id">
            <!-- The suggested day stays in its place in the rotation (so the
                 list still reads as the program) but stands out. -->
            <button
              type="button"
              class="flex w-full items-center gap-3 p-3 text-left disabled:opacity-50"
              :class="{ 'bg-primary/10': day.id === activeProgram.nextDayId }"
              :disabled="starting !== null"
              @click="onStart(day.id)"
            >
              <span class="min-w-0 flex-1 truncate font-medium">{{ day.name }}</span>
              <UBadge v-if="day.id === activeProgram.nextDayId" color="primary" variant="subtle" size="sm">
                Suggéré
              </UBadge>
              <span class="text-sm text-muted">
                {{ day.exerciseCount }} exercice{{ day.exerciseCount > 1 ? 's' : '' }}
              </span>
              <UIcon
                :name="starting === day.id ? 'i-lucide-loader-circle' : 'i-lucide-play'"
                class="size-5 text-primary"
                :class="{ 'animate-spin': starting === day.id }"
              />
            </button>
          </li>
        </ul>
      </section>

      <p v-else class="text-sm text-muted">
        Pas de programme actif : crée-en un dans l'onglet Programme, ou démarre une séance libre.
      </p>

      <UButton
        label="Séance libre"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        :loading="starting === 'free'"
        :disabled="starting !== null"
        @click="onStart()"
      />
    </template>

    <!-- A session in progress. -->
    <template v-else-if="workout">
      <div>
        <h1 class="text-2xl font-bold">
          {{ title }}
        </h1>
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-muted">
            Commencée à {{ startedAt }}
          </p>
          <USwitch
            :model-value="restTimer.enabled.value"
            label="Minuteur de repos"
            size="sm"
            @update:model-value="restTimer.setEnabled"
          />
        </div>
      </div>

      <p v-if="!workout.exercises.length" class="text-muted">
        Aucun exercice pour l'instant.
      </p>

      <WorkoutExerciseCard
        v-for="item in workout.exercises"
        :key="item.id"
        :item="item"
        :plan="planFor(item.exerciseId)"
        :editor="currentWorkout"
        live
      />

      <UButton
        label="Ajouter un exercice"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        block
        @click="addOpen = true"
      />

      <AddExerciseModal v-model:open="addOpen" :add="addExercise" />

      <UButton
        :label="finishArmed ? 'Confirmer la fin de la séance' : 'Terminer la séance'"
        icon="i-lucide-flag"
        :color="finishArmed ? 'error' : 'primary'"
        block
        :loading="finishing"
        @click="onFinish"
      />

      <!-- Keeps the finish button clear of the timer bar when it shows. -->
      <div v-if="restTimer.endsAt.value !== null" class="h-16" aria-hidden="true" />
      <RestTimer />
    </template>
  </div>
</template>
