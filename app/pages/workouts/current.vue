<!--
  Current workout: the main logging screen. Without a session in progress, it
  offers to start one (a day of the active program, or a free session); with
  one, it shows its exercises and sets, lets the user add exercises outside
  the plan, and finish it.
-->
<script setup lang="ts">
useHead({ title: 'Séance en cours' })

const { workout, load, start, finish, addExercise } = useCurrentWorkout()
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

/**
 * Loads the days of the user's active program, to offer them as starting
 * points. Two calls: the list only tells which program is active, the
 * detail route holds the days.
 *
 * @returns The program's name and days, or null without an active program.
 */
async function fetchActiveProgram() {
  const programs = await requestFetch('/api/programs')
  const active = programs.find(p => p.active)
  if (!active) return null
  const program = await requestFetch(`/api/programs/${active.id}`)
  return {
    name: program.name,
    days: program.days.map(d => ({ id: d.id, name: d.name, exerciseCount: d.exercises.length })),
  }
}

// Only needed on the start screen. `watch` reloads it when the session is
// finished, since the page then switches back to that screen.
const { data: activeProgram } = await useAsyncData(
  'active-program-days',
  () => (workout.value === null ? fetchActiveProgram() : Promise.resolve(null)),
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

// --- Adding an exercise ---

// The catalogue for the picker. Lazy and client-only: only needed once the
// user opens the modal, and the logging screen must not wait for it.
const { data: catalogue } = useFetch('/api/exercises', { lazy: true, server: false, default: () => [] })

const addOpen = ref(false)
const addedExerciseId = ref<number | undefined>(undefined)
const adding = ref(false)

/** Opens the picker, cleared of the exercise picked last time. */
function openAdd() {
  addedExerciseId.value = undefined
  addOpen.value = true
}

/**
 * Adds the picked exercise at the end of the session. Not optimistic (see
 * addExercise), so the modal stays open with a spinner until it is saved; on
 * failure the composable shows a toast and the modal stays open to retry.
 */
async function onAddExercise() {
  if (addedExerciseId.value === undefined) return
  adding.value = true
  if (await addExercise(addedExerciseId.value)) addOpen.value = false
  adding.value = false
}

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
  if (await finish()) toast.add({ title: 'Séance terminée', color: 'success' })
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
            <button
              type="button"
              class="flex w-full items-center gap-3 p-3 text-left disabled:opacity-50"
              :disabled="starting !== null"
              @click="onStart(day.id)"
            >
              <span class="min-w-0 flex-1 truncate font-medium">{{ day.name }}</span>
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
        <p class="text-sm text-muted">
          Commencée à {{ startedAt }}
        </p>
      </div>

      <p v-if="!workout.exercises.length" class="text-muted">
        Aucun exercice pour l'instant.
      </p>

      <WorkoutExerciseCard
        v-for="item in workout.exercises"
        :key="item.id"
        :item="item"
        :plan="planFor(item.exerciseId)"
      />

      <UButton
        label="Ajouter un exercice"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        block
        @click="openAdd"
      />

      <UModal v-model:open="addOpen" title="Ajouter un exercice">
        <template #body>
          <div class="space-y-4">
            <!-- Searchable: the catalogue holds dozens of exercises. -->
            <USelectMenu
              v-model="addedExerciseId"
              :items="catalogue"
              value-key="id"
              label-key="name"
              placeholder="Choisir un exercice"
              :search-input="{ placeholder: 'Rechercher…' }"
              class="w-full"
            />
            <UButton
              label="Ajouter"
              block
              :disabled="addedExerciseId === undefined"
              :loading="adding"
              @click="onAddExercise"
            />
          </div>
        </template>
      </UModal>

      <UButton
        :label="finishArmed ? 'Confirmer la fin de la séance' : 'Terminer la séance'"
        icon="i-lucide-flag"
        :color="finishArmed ? 'error' : 'primary'"
        block
        :loading="finishing"
        @click="onFinish"
      />
    </template>
  </div>
</template>
