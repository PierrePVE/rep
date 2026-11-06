<!--
  Detail of a finished session, from the history. Everything stays editable
  after the fact, with the same cards as the logging screen: rename it, write
  notes, add, replace or remove its photo, add or remove exercises, fix, add
  or delete sets. It can also be deleted. A session still in progress is sent to the logging screen instead.
-->
<script setup lang="ts">
import type { CurrentWorkout } from '~/composables/useCurrentWorkout'

const route = useRoute()
const id = Number(route.params.id)

const { data, error } = await useFetch(`/api/workouts/${id}`)

// Copied into a local ref that the editor changes in place (optimistic
// updates); useFetch's own data is just the starting point.
const workout = ref<CurrentWorkout | null>(null)
watch(data, (value) => { workout.value = value?.workout ?? null }, { immediate: true })

// The session in progress has its own screen (rest timer, "last time"
// reminders), which also owns its state: editing it here would let the two
// copies drift apart.
if (workout.value && workout.value.endedAt === null) {
  await navigateTo('/workouts/current', { replace: true })
}

const editor = useWorkoutEditor(workout)
const toast = useToast()

const title = computed(() => workout.value?.name ?? 'Séance libre')
// Generic while there is no session (404), rather than "Séance libre".
useHead({ title: () => (workout.value ? title.value : 'Séance') })

/**
 * Day and times, e.g. "jeudi 29 octobre 2026 · 18:02 – 19:10". When the
 * session ended on another day (finished after midnight, or forgotten and
 * finished later), the end gets its own date, so "23:40 – 00:35" or
 * "12:55 – 12:20" never reads as going back in time.
 */
const when = computed(() => {
  const w = workout.value
  if (!w) return ''
  const start = new Date(w.startedAt)
  const day = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = (date: Date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (!w.endedAt) return day
  const end = new Date(w.endedAt)
  const sameDay = end.toDateString() === start.toDateString()
  return `${day} · ${time(start)} – ${sameDay ? '' : `${formatDay(w.endedAt)} `}${time(end)}`
})

/**
 * Volume of the session, computed here rather than taken from the list: it
 * must follow the edits made on this page. Same rule as GET /api/workouts
 * (warm-ups left out).
 */
const volumeKg = computed(() => (workout.value?.exercises ?? [])
  .flatMap(e => e.sets)
  .filter(s => s.type !== 'warmup')
  .reduce((total, s) => total + s.weightKg * s.reps, 0))

type PlanEntry = CurrentWorkout['plan'][number]

/**
 * Finds the program targets of an exercise, as on the logging screen.
 *
 * @param exerciseId - Exercise of the catalogue.
 * @returns The targets, or undefined for an exercise outside the plan.
 */
function planFor(exerciseId: number): PlanEntry | undefined {
  return workout.value?.plan.find(p => p.exerciseId === exerciseId)
}

// --- Name and notes ---

const renameOpen = ref(false)

/**
 * Renames the session. Throws on failure, so NameModal shows the message.
 *
 * @param name - New name, already trimmed.
 */
async function rename(name: string) {
  const updated = await $fetch(`/api/workouts/${id}`, { method: 'PATCH', body: { name } })
  if (workout.value) workout.value.name = updated.name
}

// Draft of the notes field; saved only on demand, not on every keystroke.
const notes = ref('')
watch(() => workout.value?.notes, (value) => { notes.value = value ?? '' }, { immediate: true })
const notesDirty = computed(() => notes.value.trim() !== (workout.value?.notes ?? ''))
const savingNotes = ref(false)

/** Saves the notes; an emptied field clears them (the API stores null). */
async function saveNotes() {
  savingNotes.value = true
  try {
    const updated = await $fetch(`/api/workouts/${id}`, { method: 'PATCH', body: { notes: notes.value } })
    if (workout.value) workout.value.notes = updated.notes
    toast.add({ title: 'Notes enregistrées', color: 'success' })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingNotes.value = false
  }
}

// --- Exercises ---

const addOpen = ref(false)

// --- Deletion ---

// Two steps, as the other deletions: it erases the whole session.
const deleteArmed = ref(false)
const deleting = ref(false)

/** First tap arms the button, the second one deletes and goes back. */
async function onDelete() {
  if (!deleteArmed.value) {
    deleteArmed.value = true
    return
  }
  deleting.value = true
  try {
    await $fetch(`/api/workouts/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Séance supprimée', color: 'success' })
    await navigateTo('/workouts')
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
    deleteArmed.value = false
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <UButton to="/workouts" icon="i-lucide-arrow-left" label="Historique" color="neutral" variant="link" class="px-0" />

    <p v-if="error" class="text-error">
      {{ error.statusCode === 404 ? 'Séance introuvable.' : 'Impossible de charger la séance.' }}
    </p>

    <template v-else-if="workout">
      <div>
        <div class="flex items-start gap-2">
          <h1 class="min-w-0 flex-1 text-2xl font-bold">
            {{ title }}
          </h1>
          <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" aria-label="Renommer la séance" @click="renameOpen = true" />
        </div>
        <p class="text-sm text-muted first-letter:uppercase">
          {{ when }}
        </p>
        <p class="text-sm text-muted">
          <template v-if="workout.endedAt">
            {{ formatDuration(workout.startedAt, workout.endedAt) }} ·
          </template>
          Volume {{ formatVolume(volumeKg) }}
        </p>
      </div>

      <WorkoutPhoto v-model:photo-url="workout.photoUrl" :workout-id="workout.id" />

      <NameModal
        v-model:open="renameOpen"
        title="Renommer la séance"
        submit-label="Renommer"
        :initial-name="workout.name ?? ''"
        placeholder="Push A"
        :save="rename"
      />

      <p v-if="!workout.exercises.length" class="text-muted">
        Aucun exercice dans cette séance.
      </p>

      <WorkoutExerciseCard
        v-for="item in workout.exercises"
        :key="item.id"
        :item="item"
        :plan="planFor(item.exerciseId)"
        :editor="editor"
      />

      <UButton
        label="Ajouter un exercice"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        block
        @click="addOpen = true"
      />
      <AddExerciseModal v-model:open="addOpen" :add="editor.addExercise" />

      <section class="space-y-2">
        <h2 class="text-sm font-medium text-muted">
          Notes
        </h2>
        <UTextarea v-model="notes" :rows="3" autoresize placeholder="Sensations, douleurs, matériel…" class="w-full" />
        <UButton
          v-if="notesDirty"
          label="Enregistrer les notes"
          size="sm"
          :loading="savingNotes"
          @click="saveNotes"
        />
      </section>

      <UButton
        block
        icon="i-lucide-trash-2"
        :color="deleteArmed ? 'error' : 'neutral'"
        :variant="deleteArmed ? 'solid' : 'subtle'"
        :loading="deleting"
        @click="onDelete"
      >
        {{ deleteArmed ? 'Confirmer la suppression' : 'Supprimer la séance' }}
      </UButton>
    </template>
  </div>
</template>
