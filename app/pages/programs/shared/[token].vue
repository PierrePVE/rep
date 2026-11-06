<!--
  Shared program preview: what a share link opens. Shows the program read-only
  and imports a copy into the viewer's programs. Logged-out visitors are sent
  to the login page by the auth middleware, which brings them back here.
-->
<script setup lang="ts">
const route = useRoute()
const token = String(route.params.token)

const { data, error } = await useFetch(`/api/shared-programs/${token}`)

useHead({ title: () => data.value?.program.name ?? 'Programme partagé' })

const { pending: importing, run: runImport } = useAction()

/** Imports a copy, then opens it so the user can adjust it right away. */
async function onImport() {
  let id: number | undefined
  const ok = await runImport(async () => {
    const res = await $fetch(`/api/shared-programs/${token}/import`, { method: 'POST' })
    id = res.program.id
  }, 'Programme importé')
  if (ok && id) await navigateTo(`/programs/${id}`)
}

/**
 * Formats the target of a planned exercise, e.g. "3 × 8–12" or "5 × 5".
 *
 * @param e - Planned exercise with its target sets and rep range.
 * @param e.targetSets - Number of sets.
 * @param e.repMin - Low end of the rep range.
 * @param e.repMax - High end of the rep range.
 * @returns The formatted target.
 */
function target(e: { targetSets: number, repMin: number, repMax: number }) {
  return `${e.targetSets} × ${e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}`
}
</script>

<template>
  <div class="space-y-4">
    <UButton to="/programs" color="neutral" variant="link" icon="i-lucide-arrow-left" class="px-0">
      Programmes
    </UButton>

    <!-- 404 covers both a wrong link and a revoked one: the API does not tell
         them apart, so as not to reveal which tokens once existed. -->
    <div v-if="error || !data" class="space-y-2">
      <h1 class="text-2xl font-bold">
        Lien indisponible
      </h1>
      <p class="text-muted">
        {{ error?.status === 404 ? 'Ce lien de partage n\'existe pas ou a été révoqué.' : 'Impossible de charger le programme.' }}
      </p>
    </div>

    <template v-else>
      <div>
        <p class="text-sm text-muted">
          Programme partagé
        </p>
        <h1 class="text-2xl font-bold">
          {{ data.program.name }}
        </h1>
      </div>

      <UAlert
        v-if="data.mine"
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="C'est votre programme"
        description="L'importer en créera une copie."
      />

      <div class="space-y-1">
        <UButton
          icon="i-lucide-download"
          label="Importer dans mes programmes"
          :loading="importing"
          block
          @click="onImport"
        />
        <p class="text-sm text-muted">
          Une copie indépendante est ajoutée à vos programmes. Les exercices manquants sont ajoutés à votre bibliothèque.
        </p>
      </div>

      <p v-if="!data.program.days.length" class="text-muted">
        Ce programme ne contient aucune séance.
      </p>

      <ol v-else class="space-y-3">
        <li v-for="day in data.program.days" :key="day.position" class="rounded-lg border border-default">
          <p class="border-b border-default px-3 py-2 font-medium">
            {{ day.name }}
          </p>
          <p v-if="!day.exercises.length" class="p-3 text-sm text-muted">
            Aucun exercice.
          </p>
          <ul v-else class="divide-y divide-default">
            <li v-for="e in day.exercises" :key="e.position" class="flex items-center gap-3 px-3 py-2 text-sm">
              <div class="min-w-0 flex-1">
                <p class="truncate">
                  {{ e.exercise.name }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ MUSCLE_GROUP_LABELS[e.exercise.muscleGroup] }} · {{ EQUIPMENT_LABELS[e.exercise.equipment] }}
                </p>
              </div>
              <span class="text-muted">{{ target(e) }}</span>
            </li>
          </ul>
        </li>
      </ol>
    </template>
  </div>
</template>
