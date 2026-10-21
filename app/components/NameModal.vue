<!--
  Modal with a single "name" field, used to create or rename programs and
  session days. The error is shown inline rather than as a toast: the usual
  failure is a duplicate name, which the user fixes in the same form.

  Props:
  - title: modal title (also its accessible name, so it is required).
  - submitLabel: text of the submit button.
  - initialName: value the field starts with each time the modal opens.
  - placeholder: optional example shown in the empty field.
  - save: performs the API call with the trimmed name. It must throw on
    failure (as $fetch does); the modal then stays open with the message.
  v-model:open: whether the modal is shown.
  Default slot: optional trigger button, as in UModal.
-->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

const props = withDefaults(defineProps<{
  title: string
  submitLabel: string
  initialName?: string
  placeholder?: string
  save: (name: string) => Promise<void>
}>(), { initialName: '', placeholder: undefined })

const open = defineModel<boolean>('open', { default: false })

// Same rules for every name of the editor (programs and days).
const state = reactive({ name: '' })
const pending = ref(false)
const error = ref<string | null>(null)

// Reset each time the modal opens, so a name or an error left from a
// cancelled attempt does not come back.
watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = props.initialName
  error.value = null
})

/**
 * Calls `save` with the validated name, closing the modal on success and
 * showing the API message inline on failure.
 *
 * @param event - Form submit event; `event.data` is the Zod-parsed output
 *   (name already trimmed).
 */
async function onSubmit(event: FormSubmitEvent<ProgramInput>) {
  pending.value = true
  error.value = null
  try {
    await props.save(event.data.name)
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
      <!-- programSchema and programDaySchema are the same { name } rule. -->
      <UForm :schema="programSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
        <UFormField label="Nom" name="name">
          <UInput v-model="state.name" :placeholder="placeholder" autofocus class="w-full" />
        </UFormField>
        <!-- Inside the form (not in the modal footer) so Enter submits it. -->
        <UButton type="submit" block :loading="pending">
          {{ submitLabel }}
        </UButton>
      </UForm>
    </template>
  </UModal>
</template>
