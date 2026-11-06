<!--
  Modal form for one set of the session in progress: weight, reps, optional
  RPE and set type. Used both to log a set and to edit one; in edit mode it
  also offers a two-step delete.

  Unlike NameModal or PlannedExerciseModal, it does not wait for the API: the
  set calls of useCurrentWorkout are optimistic (the change shows at once, a
  failure is undone with a toast), so the modal closes as soon as the form is
  valid and the page runs the call behind it. At the gym, logging a set must
  never leave a spinner on screen.

  Props:
  - title: modal title (also its accessible name, so it is required).
  - submitLabel: text of the submit button.
  - initial: values to fill the form with when it opens (the edited set, or a
    prefill for a new one). A missing weight leaves the field empty, so the
    schema reports it as required.
  - editing: true in edit mode, which shows the delete button.
  v-model:open: whether the modal is shown.
  Events:
  - submit(input): the validated set (type defaulted to 'normal').
  - remove(): the user confirmed the deletion (edit mode only).
-->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

/** Values the form opens with. */
interface SetFormValues {
  weightKg?: number
  reps?: number
  rpe?: number | null
  type?: SetType
}

const props = defineProps<{
  title: string
  submitLabel: string
  initial: SetFormValues
  editing?: boolean
}>()

const emit = defineEmits<{
  submit: [input: SetInput]
  remove: []
}>()

const open = defineModel<boolean>('open', { default: false })

/**
 * Builds the form values from `initial`.
 *
 * @returns A fresh state object.
 */
function initialState() {
  return {
    weightKg: props.initial.weightKg,
    reps: props.initial.reps,
    rpe: props.initial.rpe ?? null,
    type: props.initial.type ?? 'normal',
  }
}

const state = reactive(initialState())
const removeArmed = ref(false)

// Reset each time the modal opens: `initial` changes with the set being
// edited (or the previous set, for a prefill), and an armed delete must not
// survive a cancelled attempt.
watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, initialState())
  removeArmed.value = false
})

// Labels of the type picker. Work sets have no badge label (SET_TYPE_LABELS
// is null for them), so they get their own wording here.
const typeItems = SET_TYPES.map(type => ({ value: type, label: SET_TYPE_LABELS[type] ?? 'Normale' }))

/**
 * Hands the validated set to the page and closes at once (see the header).
 *
 * @param event - Form submit event; `event.data` is the Zod-parsed output.
 */
function onSubmit(event: FormSubmitEvent<SetInput>) {
  emit('submit', event.data)
  open.value = false
}

/** First tap arms the delete button, the second one confirms it. */
function onRemove() {
  if (!removeArmed.value) {
    removeArmed.value = true
    return
  }
  emit('remove')
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <template #body>
      <UForm :schema="setSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-2 gap-3">
          <!-- Steps of 2.5 kg, the smallest pair of plates in most gyms; any
               value can still be typed (e.g. 1.25 kg micro-plates). -->
          <UFormField label="Poids (kg)" name="weightKg" hint="0 = PDC">
            <UInputNumber v-model="state.weightKg" :min="0" :max="1000" :step="2.5" />
          </UFormField>
          <UFormField label="Reps" name="reps">
            <UInputNumber v-model="state.reps" :min="1" :max="100" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="RPE" name="rpe" hint="Optionnel">
            <UInputNumber v-model="state.rpe" :min="1" :max="10" :step="0.5" placeholder="8" />
          </UFormField>
          <UFormField label="Type" name="type">
            <USelect v-model="state.type" :items="typeItems" class="w-full" />
          </UFormField>
        </div>

        <!-- Inside the form (not in the modal footer) so Enter submits it. -->
        <UButton type="submit" block>
          {{ submitLabel }}
        </UButton>

        <UButton
          v-if="editing"
          block
          icon="i-lucide-trash-2"
          :color="removeArmed ? 'error' : 'neutral'"
          :variant="removeArmed ? 'solid' : 'subtle'"
          @click="onRemove"
        >
          {{ removeArmed ? 'Confirmer la suppression' : 'Supprimer la série' }}
        </UButton>
      </UForm>
    </template>
  </UModal>
</template>
