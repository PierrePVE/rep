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
    </template>
  </div>
</template>
