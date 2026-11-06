<!--
  Exercise page: the current records of an exercise, the estimated 1RM and
  the volume of each session as charts, and the history of its sets (which
  doubles as the table view of the charts: every plotted value is there).
-->
<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)

const { data, error } = await useFetch(`/api/exercises/${id}/stats`)

useHead({ title: () => data.value?.exercise.name ?? 'Exercice' })

const records = computed(() => data.value?.records)
// Sessions where the exercise has at least one set: an exercise added to a
// session and left empty would only add a blank point to the charts.
const sessions = computed(() => (data.value?.sessions ?? []).filter(s => s.sets.length))

/** Short date of a session for the chart axes, e.g. "28 oct.". */
function shortDay(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// The e1RM chart skips the sessions without an estimate (bodyweight, or all
// sets above 12 reps) rather than drawing a gap for each.
const e1rmSessions = computed(() => sessions.value.filter(s => s.bestE1rm !== null))
const hasWeight = computed(() => sessions.value.some(s => s.volumeKg > 0))

/** History, newest first (the API sends the sessions oldest first). */
const history = computed(() => [...sessions.value].reverse())
</script>

<template>
  <div class="space-y-6">
    <UButton to="/exercises" icon="i-lucide-arrow-left" label="Exercices" color="neutral" variant="link" class="px-0" />

    <p v-if="error" class="text-error">
      {{ error.statusCode === 404 ? 'Exercice introuvable.' : 'Impossible de charger l\'exercice.' }}
    </p>

    <template v-else-if="data && records">
      <div>
        <h1 class="text-2xl font-bold">
          {{ data.exercise.name }}
        </h1>
        <p class="text-sm text-muted">
          {{ MUSCLE_GROUP_LABELS[data.exercise.muscleGroup] }} · {{ EQUIPMENT_LABELS[data.exercise.equipment] }}
          <template v-if="data.exercise.archived">
            · Archivé
          </template>
        </p>
      </div>

      <p v-if="!sessions.length" class="text-muted">
        Pas encore de série sur cet exercice.
      </p>

      <template v-else>
        <!-- Records: the headline numbers, as tiles rather than a chart. -->
        <section class="space-y-2">
          <h2 class="font-medium">
            Records
          </h2>
          <div class="grid grid-cols-3 gap-2">
            <div v-if="records.maxWeight" class="rounded-lg border border-default p-3">
              <p class="text-xs text-muted">
                Poids max
              </p>
              <p class="text-lg font-bold tabular-nums">
                {{ formatWeight(records.maxWeight.weightKg) }}
              </p>
              <p class="text-xs text-muted">
                × {{ records.maxWeight.reps }} · {{ shortDay(records.maxWeight.startedAt) }}
              </p>
            </div>
            <div v-if="records.e1rm" class="rounded-lg border border-default p-3">
              <p class="text-xs text-muted">
                1RM estimé
              </p>
              <p class="text-lg font-bold tabular-nums">
                {{ formatWeight(records.e1rm.value) }}
              </p>
              <p class="text-xs text-muted">
                {{ formatWeight(records.e1rm.weightKg) }} × {{ records.e1rm.reps }}
              </p>
            </div>
            <div v-if="records.setVolume" class="rounded-lg border border-default p-3">
              <p class="text-xs text-muted">
                Meilleure série
              </p>
              <p class="text-lg font-bold tabular-nums">
                {{ formatVolume(records.setVolume.value) }}
              </p>
              <p class="text-xs text-muted">
                {{ formatWeight(records.setVolume.weightKg) }} × {{ records.setVolume.reps }}
              </p>
            </div>
          </div>

          <!-- Rep max per weight: a small table, read as "at 80 kg, my best is 10 reps". -->
          <div v-if="records.repMaxes.length" class="rounded-lg border border-default">
            <p class="border-b border-default px-3 py-2 text-xs text-muted">
              Record de reps par charge
            </p>
            <ul class="divide-y divide-default text-sm">
              <li v-for="entry in records.repMaxes.slice(0, 8)" :key="entry.weightKg" class="flex items-center gap-3 px-3 py-2">
                <span class="w-20 font-medium tabular-nums">{{ formatWeight(entry.weightKg) }}</span>
                <span class="flex-1 tabular-nums">{{ entry.reps }} reps</span>
                <span class="text-muted">{{ shortDay(entry.startedAt) }}</span>
              </li>
            </ul>
          </div>
        </section>

        <!-- One chart per measure: the e1RM and the volume have different
             scales, so they never share an axis. -->
        <section v-if="e1rmSessions.length > 1" class="space-y-2">
          <h2 class="font-medium">
            1RM estimé
          </h2>
          <p class="text-xs text-muted">
            Meilleure série de chaque séance (formule d'Epley, séries de 12 reps ou moins).
          </p>
          <StatChart
            type="line"
            :labels="e1rmSessions.map(s => shortDay(s.startedAt))"
            :values="e1rmSessions.map(s => s.bestE1rm)"
            unit="kg"
          />
        </section>

        <section v-if="hasWeight && sessions.length > 1" class="space-y-2">
          <h2 class="font-medium">
            Volume par séance
          </h2>
          <p class="text-xs text-muted">
            Poids × reps de toutes les séries, échauffements exclus.
          </p>
          <StatChart
            type="bar"
            :labels="sessions.map(s => shortDay(s.startedAt))"
            :values="sessions.map(s => s.volumeKg)"
            unit="kg"
          />
        </section>

        <section class="space-y-2">
          <h2 class="font-medium">
            Historique
          </h2>
          <ul class="divide-y divide-default rounded-lg border border-default">
            <li v-for="session in history" :key="session.workoutId">
              <NuxtLink :to="`/workouts/${session.workoutId}`" class="block p-3">
                <div class="flex items-center gap-2">
                  <span class="flex-1 text-sm font-medium first-letter:uppercase">{{ formatDay(session.startedAt) }}</span>
                  <span v-if="session.bestE1rm" class="text-xs text-muted tabular-nums">1RM ≈ {{ formatWeight(session.bestE1rm) }}</span>
                  <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
                </div>
                <p class="mt-1 text-sm text-muted tabular-nums">
                  <template v-for="(s, index) in session.sets" :key="s.id">
                    <template v-if="index">
                      ·
                    </template>
                    <span :class="{ 'opacity-60': s.type === 'warmup' }">{{ formatWeight(s.weightKg) }} × {{ s.reps }}</span>
                  </template>
                </p>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>
