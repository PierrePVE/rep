<!--
  Modal form for a planned exercise of a session day: picks the exercise and
  sets its targets (sets, rep range, optional RPE, rest and notes). Used both
  to add an exercise to a day and to edit one. As in NameModal, the API error
  is shown inline so the user can fix the form without retyping it.

  Props:
  - title: modal title (also its accessible name, so it is required).
  - submitLabel: text of the submit button.
  - planned: the planned exercise being edited; omitted when adding. In edit
    mode the exercise cannot be changed (the PATCH route refuses it), so its
    name is shown read-only instead of the picker.
  - save: performs the API call with the validated input. It must throw on
    failure (as $fetch does); the modal then stays open with the message.
  v-model:open: whether the modal is shown.
  Default slot: optional trigger button, as in UModal.
-->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

/** Planned exercise as returned by GET /api/programs/:id. */
interface PlannedExercise {
  exerciseId: number
  targetSets: number
  repMin: number
  repMax: number
  targetRpe: number | null
  restSeconds: number | null
  notes: string | null
  exercise: { name: string }
}

const props = defineProps<{
  title: string
  submitLabel: string
  planned?: PlannedExercise | null
  save: (input: ProgramExerciseInput) => Promise<void>
}>()

const open = defineModel<boolean>('open', { default: false })

/**
 * Builds the form values: the edited exercise's, or defaults for a new one.
 * 3 × 8–12 is a common hypertrophy target, so most additions need no typing.
 *
 * @returns A fresh state object.
 */
function initialState() {
  const p = props.planned
  return {
    // undefined until picked, so the schema reports "required" on that field.
    exerciseId: p?.exerciseId,
    targetSets: p?.targetSets ?? 3,
    repMin: p?.repMin ?? 8,
    repMax: p?.repMax ?? 12,
    targetRpe: p?.targetRpe ?? null,
    restSeconds: p?.restSeconds ?? null,
    // A string for the textarea; turned back into null on submit when empty.
    notes: p?.notes ?? '',
  }
}

const state = reactive(initialState())
const pending = ref(false)
const error = ref<string | null>(null)

// Reset each time the modal opens, so values or an error left from a
// cancelled attempt (or from another exercise) do not come back.
watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, initialState())
  error.value = null
})

/**
 * Calls `save` with the validated input, closing the modal on success and
 * showing the API message inline on failure.
 *
 * @param event - Form submit event; `event.data` is the Zod-parsed output
 *   (notes already trimmed).
 */
async function onSubmit(event: FormSubmitEvent<ProgramExerciseInput>) {
  pending.value = true
  error.value = null
  try {
    // An emptied notes field must clear the stored notes, not save "".
    await props.save({ ...event.data, notes: event.data.notes || null })
    open.value = false
  }
  catch (e) {
    error.value = apiErrorMessage(e)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <!-- Forwarded only when given: UModal wraps any default slot in a dialog
         trigger, which would be empty for a modal opened by v-model alone. -->
    <template v-if="$slots.default" #default>
      <slot />
    </template>

    <template #body>
      <!-- The add schema also fits editing: exerciseId is in the state either
           way, and the page drops it before calling the PATCH route. -->
      <UForm :schema="programExerciseSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

        <UFormField label="Exercice" name="exerciseId">
          <UInput v-if="planned" :model-value="planned.exercise.name" disabled class="w-full" />
          <!-- Searchable, and creates the exercise when it is missing. -->
          <ExercisePicker v-else v-model="state.exerciseId" />
        </UFormField>

        <div class="grid grid-cols-3 gap-3">
          <UFormField label="Séries" name="targetSets">
            <UInputNumber v-model="state.targetSets" :min="1" :max="20" />
          </UFormField>
          <UFormField label="Reps min" name="repMin">
            <UInputNumber v-model="state.repMin" :min="1" :max="100" />
          </UFormField>
          <UFormField label="Reps max" name="repMax">
            <UInputNumber v-model="state.repMax" :min="1" :max="100" />
          </UFormField>
        </div>

        <!-- Optional targets: left empty they stay null. -->
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="RPE cible" name="targetRpe" hint="Optionnel">
            <UInputNumber v-model="state.targetRpe" :min="1" :max="10" :step="0.5" placeholder="8" />
          </UFormField>
          <UFormField label="Repos (s)" name="restSeconds" hint="Optionnel">
            <UInputNumber v-model="state.restSeconds" :min="0" :max="3600" :step="15" placeholder="120" />
          </UFormField>
        </div>

        <UFormField label="Notes" name="notes" hint="Optionnel">
          <UTextarea v-model="state.notes" :rows="2" autoresize class="w-full" />
        </UFormField>

        <!-- Inside the form (not in the modal footer) so Enter submits it. -->
        <UButton type="submit" block :loading="pending">
          {{ submitLabel }}
        </UButton>
      </UForm>
    </template>
  </UModal>
</template>
