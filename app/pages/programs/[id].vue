<!--
  Program page: shows one program with its session days and their planned
  exercises, and lets the user rename, activate or delete it.
-->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

const route = useRoute()
// Kept as a string: the API validates it and answers 400 / 404 on a bad id,
// which ends up in the "not found" state below.
const id = String(route.params.id)

const { data: program, error, refresh } = await useFetch(`/api/programs/${id}`)

useHead({ title: () => program.value?.name ?? 'Programme' })

// Rename modal. The error is shown inline (as in the creation modal), since
// the usual failure is a duplicate name the user fixes in the same form.
const renameOpen = ref(false)
const renameState = reactive({ name: '' })
const renaming = ref(false)
const renameError = ref<string | null>(null)

// Prefill with the current name each time the modal opens, so an edit that
// was cancelled does not come back.
watch(renameOpen, (open) => {
  if (!open) return
  renameState.name = program.value?.name ?? ''
  renameError.value = null
})

/**
 * Renames the program, then closes the modal and reloads the page data.
 *
 * @param event - Form submit event; `event.data` is the Zod-parsed output
 *   (name already trimmed).
 */
async function onRename(event: FormSubmitEvent<ProgramInput>) {
  renaming.value = true
  renameError.value = null
  try {
    await $fetch(`/api/programs/${id}`, { method: 'PATCH', body: event.data })
    renameOpen.value = false
    await refresh()
  }
  catch (e) {
    renameError.value = apiErrorMessage(e)
  }
  finally {
    renaming.value = false
  }
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

        <!-- The title is required: without it the dialog has no accessible name. -->
        <UModal v-model:open="renameOpen" title="Renommer le programme">
          <UButton label="Renommer" icon="i-lucide-pencil" color="neutral" variant="subtle" />

          <template #body>
            <UForm :schema="programSchema" :state="renameState" class="space-y-4" @submit="onRename">
              <UAlert v-if="renameError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="renameError" />
              <UFormField label="Nom" name="name">
                <UInput v-model="renameState.name" autofocus class="w-full" />
              </UFormField>
              <!-- Inside the form (not in the modal footer) so Enter submits it. -->
              <UButton type="submit" block :loading="renaming">
                Enregistrer
              </UButton>
            </UForm>
          </template>
        </UModal>

        <UButton
          :color="deleteArmed ? 'error' : 'neutral'"
          :variant="deleteArmed ? 'solid' : 'subtle'"
          icon="i-lucide-trash-2"
          :loading="deleting"
          @click="onDelete"
        >
          {{ deleteArmed ? 'Confirmer la suppression' : 'Supprimer' }}
        </UButton>
      </div>

      <h2 class="pt-2 text-lg font-semibold">
        Séances
      </h2>

      <p v-if="!program.days.length" class="text-muted">
        Aucune séance pour l'instant.
      </p>

      <!-- Days come sorted by position: that order is the rotation. -->
      <ol v-else class="space-y-3">
        <li v-for="day in program.days" :key="day.id" class="rounded-lg border border-default">
          <p class="border-b border-default p-3 font-medium">
            {{ day.name }}
          </p>
          <p v-if="!day.exercises.length" class="p-3 text-sm text-muted">
            Aucun exercice.
          </p>
          <ul v-else class="divide-y divide-default">
            <li v-for="planned in day.exercises" :key="planned.id" class="flex items-center gap-3 p-3 text-sm">
              <span class="min-w-0 flex-1 truncate">{{ planned.exercise.name }}</span>
              <!-- A single number when min and max are equal ("3 × 5"). -->
              <span class="text-muted">
                {{ planned.targetSets }} × {{ planned.repMin === planned.repMax ? planned.repMin : `${planned.repMin}–${planned.repMax}` }}
              </span>
            </li>
          </ul>
        </li>
      </ol>
    </template>
  </div>
</template>
