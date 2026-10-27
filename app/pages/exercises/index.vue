<!--
  Exercise library: lists the current user's catalogue with a search field,
  creates and edits exercises, and archives or restores them. Archived
  exercises are shown apart (behind a switch): they stay in history and stats
  but leave the pickers.
-->
<script setup lang="ts">
useHead({ title: 'Exercices' })

const toast = useToast()

// Active or archived list. Passed as a reactive query, so flipping the switch
// refetches on its own.
const showArchived = ref(false)
const { data: exercises, status, refresh } = await useFetch('/api/exercises', {
  query: { archived: showArchived },
  default: () => [],
})

/** One exercise as returned by GET /api/exercises. */
type Exercise = NonNullable<typeof exercises.value>[number]

/**
 * Lowercases and strips accents, so "dev" finds "Développé" and "ecarte"
 * finds "Écarté": nobody types accents on a phone at the gym.
 *
 * @param text - Text to normalize.
 * @returns The comparable form of the text.
 */
function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

// Filtered in the browser: the catalogue holds a few dozen rows, already
// loaded, so a server-side search would only add round trips.
const search = ref('')
const filtered = computed(() => {
  const query = normalize(search.value.trim())
  if (!query) return exercises.value
  return exercises.value.filter(exercise => normalize(exercise.name).includes(query))
})

// A single modal creates and edits: `edited` is the exercise being edited,
// null when creating.
const modalOpen = ref(false)
const edited = ref<Exercise | null>(null)

/** Opens the modal empty, to create an exercise. */
function openCreate() {
  edited.value = null
  modalOpen.value = true
}

/**
 * Opens the modal prefilled with an exercise, to edit it.
 *
 * @param exercise - The exercise to edit.
 */
function openEdit(exercise: Exercise) {
  edited.value = exercise
  modalOpen.value = true
}

/**
 * Saves the modal's form: PATCH when editing, POST when creating, then
 * reloads the list. Errors propagate to the modal, which shows them inline.
 *
 * @param input - Validated form values.
 */
async function saveExercise(input: ExerciseInput) {
  if (edited.value) {
    await $fetch(`/api/exercises/${edited.value.id}`, { method: 'PATCH', body: input })
    toast.add({ title: 'Exercice modifié', color: 'success' })
    await refresh()
    return
  }
  await $fetch('/api/exercises', { method: 'POST', body: input })
  toast.add({ title: 'Exercice créé', color: 'success' })
  // A new exercise is active: show that list, so it does not seem to vanish.
  // Changing the switch refetches by itself; otherwise reload explicitly.
  if (showArchived.value) showArchived.value = false
  else await refresh()
}

// Which row shows the spinner: one useAction is shared by all the buttons.
const togglingId = ref<number | null>(null)
const { run: runToggle } = useAction()

/**
 * Archives an active exercise or restores an archived one. No two-step
 * confirm, unlike deletions: it is undone with the same button.
 *
 * @param exercise - The exercise to archive or restore.
 */
async function toggleArchived(exercise: Exercise) {
  togglingId.value = exercise.id
  const ok = await runToggle(
    async () => {
      await $fetch(`/api/exercises/${exercise.id}`, { method: 'PATCH', body: { archived: !exercise.archived } })
    },
    exercise.archived ? 'Exercice restauré' : 'Exercice archivé',
  )
  if (ok) await refresh()
  togglingId.value = null
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <h1 class="flex-1 text-2xl font-bold">
        Exercices
      </h1>
      <UButton label="Nouveau" icon="i-lucide-plus" color="neutral" variant="subtle" @click="openCreate" />
    </div>

    <UInput
      v-model="search"
      icon="i-lucide-search"
      placeholder="Rechercher un exercice"
      aria-label="Rechercher un exercice"
      class="w-full"
    />

    <USwitch v-model="showArchived" label="Afficher les exercices archivés" />

    <p v-if="status === 'error'" class="text-error">
      Impossible de charger les exercices.
    </p>

    <!-- Two empty states: nothing in this list at all, or nothing matching. -->
    <p v-else-if="!exercises.length" class="text-muted">
      {{ showArchived ? 'Aucun exercice archivé.' : 'Aucun exercice pour l\'instant.' }}
    </p>
    <p v-else-if="!filtered.length" class="text-muted">
      Aucun exercice ne correspond à « {{ search.trim() }} ».
    </p>

    <ul v-else class="divide-y divide-default rounded-lg border border-default">
      <li v-for="exercise in filtered" :key="exercise.id" class="flex items-center gap-1 py-1 pr-1 pl-3">
        <!-- The whole text area opens the editor: a bigger tap target than a
             pencil icon on a phone. -->
        <button
          type="button"
          class="min-w-0 flex-1 py-1.5 text-left"
          :aria-label="`Modifier ${exercise.name}`"
          @click="openEdit(exercise)"
        >
          <p class="truncate font-medium">
            {{ exercise.name }}
          </p>
          <p class="truncate text-sm text-muted">
            {{ MUSCLE_GROUP_LABELS[exercise.muscleGroup] }} · {{ EQUIPMENT_LABELS[exercise.equipment] }}
          </p>
        </button>
        <UButton
          :icon="exercise.archived ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
          color="neutral"
          variant="ghost"
          :aria-label="`${exercise.archived ? 'Restaurer' : 'Archiver'} ${exercise.name}`"
          :loading="togglingId === exercise.id"
          @click="toggleArchived(exercise)"
        />
      </li>
    </ul>

    <ExerciseModal
      v-model:open="modalOpen"
      :title="edited ? 'Modifier l\'exercice' : 'Nouvel exercice'"
      :submit-label="edited ? 'Enregistrer' : 'Créer'"
      :exercise="edited"
      :save="saveExercise"
    />
  </div>
</template>
