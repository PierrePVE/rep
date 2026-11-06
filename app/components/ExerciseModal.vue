<!--
  Modal form for an exercise of the catalogue: name, muscle group and
  equipment. Used both to create an exercise and to edit one. As in NameModal,
  the API error is shown inline (usually a duplicate name, 409), so the user
  can fix the form without retyping it.

  Props:
  - title: modal title (also its accessible name, so it is required).
  - submitLabel: text of the submit button.
  - exercise: the exercise being edited; omitted when creating.
  - initialName: name to start a new exercise with (e.g. what was typed in
    a search field); ignored when editing.
  - save: performs the API call with the validated input. It must throw on
    failure (as $fetch does); the modal then stays open with the message.
  v-model:open: whether the modal is shown.
  Default slot: optional trigger button, as in UModal.
-->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

const props = defineProps<{
  title: string
  submitLabel: string
  exercise?: ExerciseInput | null
  initialName?: string
  save: (input: ExerciseInput) => Promise<void>
}>()

const open = defineModel<boolean>('open', { default: false })

// Select options built from the shared labels, so a value added to the enums
// shows up here without touching this component.
const muscleItems = MUSCLE_GROUPS.map(value => ({ label: MUSCLE_GROUP_LABELS[value], value }))
const equipmentItems = EQUIPMENTS.map(value => ({ label: EQUIPMENT_LABELS[value], value }))

/**
 * Builds the form values: the edited exercise's, or empty ones for a new
 * exercise. Muscle and equipment start unpicked rather than defaulting to a
 * guess, so a forgotten field is reported instead of saved wrong.
 *
 * @returns A fresh state object.
 */
function initialState() {
  return {
    name: props.exercise?.name ?? props.initialName ?? '',
    muscleGroup: props.exercise?.muscleGroup,
    equipment: props.exercise?.equipment,
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
 *   (name already trimmed).
 */
async function onSubmit(event: FormSubmitEvent<ExerciseInput>) {
  pending.value = true
  error.value = null
  try {
    await props.save(event.data)
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
      <UForm :schema="exerciseSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

        <UFormField label="Nom" name="name">
          <UInput v-model="state.name" placeholder="Développé couché" autofocus class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Muscle" name="muscleGroup">
            <USelect v-model="state.muscleGroup" :items="muscleItems" placeholder="Choisir" class="w-full" />
          </UFormField>
          <UFormField label="Équipement" name="equipment">
            <USelect v-model="state.equipment" :items="equipmentItems" placeholder="Choisir" class="w-full" />
          </UFormField>
        </div>

        <!-- Inside the form (not in the modal footer) so Enter submits it. -->
        <UButton type="submit" block :loading="pending">
          {{ submitLabel }}
        </UButton>
      </UForm>
    </template>
  </UModal>
</template>
