<!--
  Program page: shows one program with its session days and their planned
  exercises, and lets the user rename, activate or delete it.
-->
<script setup lang="ts">
const route = useRoute()
// Kept as a string: the API validates it and answers 400 / 404 on a bad id,
// which ends up in the "not found" state below.
const id = String(route.params.id)

const { data: program, error, refresh } = await useFetch(`/api/programs/${id}`)

useHead({ title: () => program.value?.name ?? 'Programme' })

const renameOpen = ref(false)

/**
 * Renames the program, then reloads the page data. Errors propagate to
 * NameModal, which shows them inline (usually a duplicate name, 409).
 *
 * @param name - Trimmed new name.
 */
async function renameProgram(name: string) {
  await $fetch(`/api/programs/${id}`, { method: 'PATCH', body: { name } })
  await refresh()
}

// One useAction per button, so each one gets its own spinner.
const { pending: activating, run: runActivate } = useAction()
const { pending: deleting, run: runDelete } = useAction()

/** Makes this program the active one (the API deactivates the previous one). */
async function onActivate() {
  const ok = await runActivate(
    async () => { await $fetch(`/api/programs/${id}/activate`, { method: 'POST' }) },
    'Programme activé',
  )
  if (ok) await refresh()
}

// Deletion is a two-step click, as on the admin page: the first click arms
// the button, the second one deletes.
const deleteArmed = ref(false)

// Same rule as the DELETE route, checked here to disable the button up front
// rather than let the user hit a 409: the active program stays as long as
// other programs exist, since one of them must always be active.
const deleteBlocked = computed(() => !!program.value?.active && program.value.otherPrograms > 0)

/** Handles a click on the delete button, then goes back to the list. */
async function onDelete() {
  if (!deleteArmed.value) {
    deleteArmed.value = true
    return
  }
  deleteArmed.value = false
  const ok = await runDelete(
    async () => { await $fetch(`/api/programs/${id}`, { method: 'DELETE' }) },
    'Programme supprimé',
  )
  if (ok) await navigateTo('/programs')
}

// --- Session days ---

/** True once the program has MAX_PROGRAM_DAYS days: the API refuses more. */
const daysFull = computed(() => (program.value?.days.length ?? 0) >= MAX_PROGRAM_DAYS)

const addDayOpen = ref(false)

/**
 * Adds a day at the end of the rotation, then reloads the page data.
 * Errors propagate to NameModal, which shows them inline.
 *
 * @param name - Trimmed day name.
 */
async function addDay(name: string) {
  await $fetch(`/api/programs/${id}/days`, { method: 'POST', body: { name } })
  await refresh()
}

// A single rename modal serves every day: it edits the day picked last.
const renameDayOpen = ref(false)
const dayToRename = ref<{ id: number, name: string } | null>(null)

/**
 * Opens the rename modal for one day.
 *
 * @param day - The day to rename; its current name prefills the field.
 */
function openRenameDay(day: { id: number, name: string }) {
  dayToRename.value = day
  renameDayOpen.value = true
}

/**
 * Renames the day picked in openRenameDay, then reloads the page data.
 *
 * @param name - Trimmed new name.
 */
async function renameDay(name: string) {
  if (!dayToRename.value) return
  await $fetch(`/api/program-days/${dayToRename.value.id}`, { method: 'PATCH', body: { name } })
  await refresh()
}

// Two-step delete, as for the program, but per day: arming another day
// disarms the previous one, so a stray second tap cannot hit the wrong day.
const armedDayId = ref<number | null>(null)
// Which day shows the spinner: one useAction is shared by all the buttons.
const deletingDayId = ref<number | null>(null)
const { run: runDeleteDay } = useAction()

/**
 * Handles a click on a day's delete button: arms it, or deletes the day
 * (with its planned exercises) if it was already armed.
 *
 * @param dayId - Id of the clicked day.
 */
async function onDeleteDay(dayId: number) {
  if (armedDayId.value !== dayId) {
    armedDayId.value = dayId
    return
  }
  armedDayId.value = null
  deletingDayId.value = dayId
  const ok = await runDeleteDay(
    async () => { await $fetch(`/api/program-days/${dayId}`, { method: 'DELETE' }) },
    'Séance supprimée',
  )
  if (ok) await refresh()
  deletingDayId.value = null
}

// --- Planned exercises ---

// The catalogue for the exercise picker. Lazy: only the modal needs it, so
// it must not hold back the first render of the page.
const { data: catalogue } = useFetch('/api/exercises', { lazy: true, default: () => [] })

/** A planned exercise as shown in a day's list. */
type Planned = NonNullable<typeof program.value>['days'][number]['exercises'][number]

// A single modal serves every day, both to add and to edit: `editedDayId` is
// the day an exercise is added to, `editedPlanned` the one being edited
// (null when adding).
const exerciseModalOpen = ref(false)
const editedDayId = ref<number | null>(null)
const editedPlanned = ref<Planned | null>(null)

/**
 * Opens the modal to add an exercise at the end of a day.
 *
 * @param dayId - Id of the day to add to.
 */
function openAddExercise(dayId: number) {
  editedDayId.value = dayId
  editedPlanned.value = null
  exerciseModalOpen.value = true
}

/**
 * Opens the modal to edit the targets of a planned exercise.
 *
 * @param planned - The planned exercise; its values prefill the form.
 */
function openEditExercise(planned: Planned) {
  editedPlanned.value = planned
  exerciseModalOpen.value = true
}

/**
 * Saves the modal's form: PATCH when editing, POST when adding, then reloads
 * the page data. Errors propagate to the modal, which shows them inline.
 *
 * @param input - Validated form values.
 */
async function saveExercise(input: ProgramExerciseInput) {
  if (editedPlanned.value) {
    // The PATCH route cannot swap the exercise and rejects the field.
    const { exerciseId: _, ...changes } = input
    await $fetch(`/api/program-exercises/${editedPlanned.value.id}`, { method: 'PATCH', body: changes })
  }
  else if (editedDayId.value !== null) {
    await $fetch(`/api/program-days/${editedDayId.value}/exercises`, { method: 'POST', body: input })
  }
  await refresh()
}

// Same two-step delete as for days, keyed by planned exercise id.
const armedPlannedId = ref<number | null>(null)
const deletingPlannedId = ref<number | null>(null)
const { run: runDeletePlanned } = useAction()

/**
 * Handles a click on a planned exercise's delete button: arms it, or removes
 * the exercise from the day if it was already armed.
 *
 * @param plannedId - Id of the clicked planned exercise.
 */
async function onDeletePlanned(plannedId: number) {
  if (armedPlannedId.value !== plannedId) {
    armedPlannedId.value = plannedId
    return
  }
  armedPlannedId.value = null
  deletingPlannedId.value = plannedId
  const ok = await runDeletePlanned(
    async () => { await $fetch(`/api/program-exercises/${plannedId}`, { method: 'DELETE' }) },
    'Exercice retiré',
  )
  if (ok) await refresh()
  deletingPlannedId.value = null
}

// Disables every move button while a reorder is in flight: a second move
// sent before the refresh would be computed from the stale order.
const { pending: moving, run: runMove } = useAction()

/**
 * Swaps a planned exercise with its neighbour, then reloads the page data.
 * The API takes the day's full new order rather than a single move.
 *
 * @param day - The day holding the exercise, with its current order.
 * @param day.id - Id of the day.
 * @param day.exercises - Its planned exercises, sorted by position.
 * @param index - Position of the exercise in the day.
 * @param offset - -1 to move it up, 1 to move it down.
 */
async function movePlanned(day: { id: number, exercises: Array<{ id: number }> }, index: number, offset: -1 | 1) {
  const ids = day.exercises.map(e => e.id)
  const target = index + offset
  if (target < 0 || target >= ids.length) return
  // Swap through a destructuring assignment; both indexes are in range.
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  // No success toast: the new order on screen is the feedback.
  const ok = await runMove(async () => {
    await $fetch(`/api/program-days/${day.id}/order`, { method: 'PUT', body: { ids } })
  })
  if (ok) await refresh()
}
</script>

<template>
  <div class="space-y-4">
    <UButton to="/programs" color="neutral" variant="link" icon="i-lucide-arrow-left" class="px-0">
      Programmes
    </UButton>

    <!-- Missing, foreign or malformed id: the API answers the same way for
         all three, and so does this page. -->
    <p v-if="error || !program" class="text-error">
      {{ error?.status === 404 || error?.status === 400 ? 'Programme introuvable.' : 'Impossible de charger le programme.' }}
    </p>

    <template v-else>
      <div class="flex items-center gap-3">
        <h1 class="min-w-0 flex-1 truncate text-2xl font-bold">
          {{ program.name }}
        </h1>
        <UBadge v-if="program.active" color="primary" variant="subtle">
          Actif
        </UBadge>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="!program.active"
          icon="i-lucide-check"
          :loading="activating"
          @click="onActivate"
        >
          Activer
        </UButton>

        <NameModal
          v-model:open="renameOpen"
          title="Renommer le programme"
          submit-label="Enregistrer"
          :initial-name="program.name"
          :save="renameProgram"
        >
          <UButton label="Renommer" icon="i-lucide-pencil" color="neutral" variant="subtle" />
        </NameModal>

        <UButton
          :color="deleteArmed ? 'error' : 'neutral'"
          :variant="deleteArmed ? 'solid' : 'subtle'"
          icon="i-lucide-trash-2"
          :loading="deleting"
          :disabled="deleteBlocked"
          @click="onDelete"
        >
          {{ deleteArmed ? 'Confirmer la suppression' : 'Supprimer' }}
        </UButton>
      </div>

      <!-- Says why the delete button is disabled: a greyed-out button alone
           does not tell the user what to do. -->
      <p v-if="deleteBlocked" class="text-sm text-muted">
        Activez un autre programme pour pouvoir supprimer celui-ci.
      </p>

      <div class="flex items-baseline gap-2 pt-2">
        <h2 class="flex-1 text-lg font-semibold">
          Séances
        </h2>
        <span class="text-sm text-muted">{{ program.days.length }} / {{ MAX_PROGRAM_DAYS }}</span>
      </div>

      <p v-if="!program.days.length" class="text-muted">
        Aucune séance pour l'instant.
      </p>

      <!-- Days come sorted by position: that order is the rotation. -->
      <ol v-else class="space-y-3">
        <li v-for="day in program.days" :key="day.id" class="rounded-lg border border-default">
          <div class="flex items-center gap-1 border-b border-default py-1 pr-1 pl-3">
            <p class="min-w-0 flex-1 truncate font-medium">
              {{ day.name }}
            </p>
            <!-- Icon-only buttons: the aria-label names the day for screen readers. -->
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              :aria-label="`Renommer ${day.name}`"
              @click="openRenameDay(day)"
            />
            <!-- Once armed, the button spells out what the next tap does. -->
            <UButton
              icon="i-lucide-trash-2"
              :color="armedDayId === day.id ? 'error' : 'neutral'"
              :variant="armedDayId === day.id ? 'solid' : 'ghost'"
              :label="armedDayId === day.id ? 'Confirmer' : undefined"
              :aria-label="`Supprimer ${day.name}`"
              :loading="deletingDayId === day.id"
              @click="onDeleteDay(day.id)"
            />
          </div>
          <p v-if="!day.exercises.length" class="p-3 text-sm text-muted">
            Aucun exercice.
          </p>
          <ul v-else class="divide-y divide-default">
            <li v-for="(planned, index) in day.exercises" :key="planned.id" class="flex items-center gap-1 py-1 pr-1 pl-3 text-sm">
              <!-- The whole name and target area opens the editor: a bigger
                   tap target than a pencil icon on a phone. -->
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
                :aria-label="`Modifier ${planned.exercise.name}`"
                @click="openEditExercise(planned)"
              >
                <span class="min-w-0 flex-1 truncate">{{ planned.exercise.name }}</span>
                <!-- A single number when min and max are equal ("3 × 5"). -->
                <span class="text-muted">
                  {{ planned.targetSets }} × {{ planned.repMin === planned.repMax ? planned.repMin : `${planned.repMin}–${planned.repMax}` }}
                </span>
              </button>
              <UButton
                icon="i-lucide-arrow-up"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="`Monter ${planned.exercise.name}`"
                :disabled="index === 0 || moving"
                @click="movePlanned(day, index, -1)"
              />
              <UButton
                icon="i-lucide-arrow-down"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="`Descendre ${planned.exercise.name}`"
                :disabled="index === day.exercises.length - 1 || moving"
                @click="movePlanned(day, index, 1)"
              />
              <UButton
                icon="i-lucide-trash-2"
                :color="armedPlannedId === planned.id ? 'error' : 'neutral'"
                :variant="armedPlannedId === planned.id ? 'solid' : 'ghost'"
                size="sm"
                :label="armedPlannedId === planned.id ? 'Confirmer' : undefined"
                :aria-label="`Retirer ${planned.exercise.name}`"
                :loading="deletingPlannedId === planned.id"
                @click="onDeletePlanned(planned.id)"
              />
            </li>
          </ul>
          <div class="border-t border-default p-1">
            <UButton
              label="Ajouter un exercice"
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="openAddExercise(day.id)"
            />
          </div>
        </li>
      </ol>

      <NameModal
        v-model:open="addDayOpen"
        title="Nouvelle séance"
        submit-label="Ajouter"
        placeholder="Push"
        :save="addDay"
      >
        <!-- Disabled rather than hidden, with the reason next to it. -->
        <UButton
          label="Ajouter une séance"
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          :disabled="daysFull"
        />
      </NameModal>
      <p v-if="daysFull" class="text-sm text-muted">
        {{ MAX_PROGRAM_DAYS }} séances maximum par programme.
      </p>

      <!-- Opened from each day's pencil button, never by a trigger of its own. -->
      <NameModal
        v-model:open="renameDayOpen"
        title="Renommer la séance"
        submit-label="Enregistrer"
        :initial-name="dayToRename?.name"
        :save="renameDay"
      />

      <!-- Opened from the days' buttons, for adding as well as editing. -->
      <PlannedExerciseModal
        v-model:open="exerciseModalOpen"
        :title="editedPlanned ? 'Modifier l\'exercice' : 'Ajouter un exercice'"
        :submit-label="editedPlanned ? 'Enregistrer' : 'Ajouter'"
        :exercises="catalogue"
        :planned="editedPlanned"
        :save="saveExercise"
      />
    </template>
  </div>
</template>
