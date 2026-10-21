<!-- Programs page: lists the current user's programs and creates new ones. -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

useHead({ title: 'Programmes' })

const toast = useToast()
const { data: programs, status } = await useFetch('/api/programs')

// Creation modal: only the name is asked, since that is all POST /api/programs
// takes. Days and exercises are added afterwards, one by one, in the editor.
const createOpen = ref(false)
const createState = reactive({ name: '' })
const creating = ref(false)
const createError = ref<string | null>(null)

// Start from a clean form each time the modal opens, so a name or an error
// left from a cancelled attempt does not come back.
watch(createOpen, (open) => {
  if (!open) return
  createState.name = ''
  createError.value = null
})

/**
 * Creates the program, then closes the modal and opens the new program.
 *
 * @param event - Form submit event; `event.data` is the Zod-parsed output
 *   (name already trimmed).
 */
async function onCreate(event: FormSubmitEvent<ProgramInput>) {
  creating.value = true
  createError.value = null
  try {
    const { program } = await $fetch('/api/programs', { method: 'POST', body: event.data })
    createOpen.value = false
    toast.add({ title: 'Programme créé', color: 'success' })
    // Straight to the new program's page: an empty program is useless until
    // its days are added there.
    await navigateTo(`/programs/${program.id}`)
  }
  catch (e) {
    // Shown inside the modal rather than as a toast: the usual failure is a
    // duplicate name (409), which the user fixes right in this form.
    createError.value = apiErrorMessage(e)
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">
      Programmes
    </h1>

    <p v-if="status === 'error'" class="text-error">
      Impossible de charger les programmes.
    </p>

    <p v-else-if="!programs?.length" class="text-muted">
      Aucun programme pour l'instant.
    </p>

    <ul v-else class="divide-y divide-default rounded-lg border border-default">
      <li v-for="program in programs" :key="program.id">
        <!-- The whole row is the link, for a comfortable touch target. -->
        <NuxtLink :to="`/programs/${program.id}`" class="flex items-center gap-3 p-3">
          <p class="min-w-0 flex-1 truncate font-medium">
            {{ program.name }}
          </p>
          <UBadge v-if="program.active" color="primary" variant="subtle">
            Actif
          </UBadge>
          <UIcon name="i-lucide-chevron-right" class="size-5 text-muted" />
        </NuxtLink>
      </li>
    </ul>

    <!-- The title is required: without it the dialog has no accessible name. -->
    <UModal v-model:open="createOpen" title="Nouveau programme">
      <UButton label="Créer un programme" icon="i-lucide-plus" color="neutral" variant="subtle" />

      <template #body>
        <UForm :schema="programSchema" :state="createState" class="space-y-4" @submit="onCreate">
          <UAlert v-if="createError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="createError" />
          <UFormField label="Nom" name="name">
            <UInput v-model="createState.name" placeholder="Push Pull Legs" autofocus class="w-full" />
          </UFormField>
          <!-- Inside the form (not in the modal footer) so Enter submits it. -->
          <UButton type="submit" block :loading="creating">
            Créer
          </UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
