<!-- Programs page: lists the current user's programs and creates new ones. -->
<script setup lang="ts">
useHead({ title: 'Programmes' })

const toast = useToast()
const { data: programs, status } = await useFetch('/api/programs')

// Creation modal: only the name is asked, since that is all POST /api/programs
// takes. Days and exercises are added afterwards, one by one, in the editor.
const createOpen = ref(false)

/**
 * Creates the program, then opens its page. Errors propagate to NameModal,
 * which shows them inline (usually a duplicate name, 409).
 *
 * @param name - Trimmed program name.
 */
async function createProgram(name: string) {
  const { program } = await $fetch('/api/programs', { method: 'POST', body: { name } })
  toast.add({ title: 'Programme créé', color: 'success' })
  // Straight to the new program's page: an empty program is useless until
  // its days are added there.
  await navigateTo(`/programs/${program.id}`)
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

    <NameModal
      v-model:open="createOpen"
      title="Nouveau programme"
      submit-label="Créer"
      placeholder="Push Pull Legs"
      :save="createProgram"
    >
      <UButton label="Créer un programme" icon="i-lucide-plus" color="neutral" variant="subtle" />
    </NameModal>

    <!-- The exercise library has no tab of its own (the bar keeps 4 tabs):
         it lives here, next to the programs that use its exercises. -->
    <NuxtLink to="/exercises" class="flex items-center gap-3 rounded-lg border border-default p-3">
      <UIcon name="i-lucide-library" class="size-5 text-primary" />
      <div class="min-w-0 flex-1">
        <p class="font-medium">
          Bibliothèque d'exercices
        </p>
        <p class="text-sm text-muted">
          Créer, modifier ou archiver tes exercices, voir leurs records
        </p>
      </div>
      <UIcon name="i-lucide-chevron-right" class="size-5 text-muted" />
    </NuxtLink>
  </div>
</template>
