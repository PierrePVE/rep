<!--
  Home: the dashboard. A card to resume the session in progress, the headline
  numbers (sessions this week against the goal, week streak, total weight
  lifted), the attendance calendar of the month, the work sets per muscle
  group over the last weeks, and the recent personal records.
-->
<script setup lang="ts">
useHead({ title: 'Accueil' })

const { data, error } = await useFetch('/api/stats/dashboard')

/**
 * Total weight lifted, in tonnes past 10 t (a 7-digit number of kg is hard to
 * read at a glance), else in kg.
 */
const totalLifted = computed(() => {
  const kg = data.value?.totalVolumeKg ?? 0
  return kg >= 10_000
    ? `${(kg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} t`
    : formatVolume(kg)
})

/** Share of the weekly goal reached, for the progress bar (capped at 100). */
const weekProgress = computed(() => {
  const week = data.value?.week
  return week ? Math.min((week.sessions / week.goal) * 100, 100) : 0
})

// Taller chart when more muscle groups are listed, so bars stay readable.
const muscleChartHeight = computed(() => `${Math.max((data.value?.muscles.length ?? 0) * 2, 6)}rem`)
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      Accueil
    </h1>

    <p v-if="error" class="text-error">
      Impossible de charger le tableau de bord.
    </p>

    <template v-else-if="data">
      <!-- The session in progress comes first: resuming it is what the user
           most likely opened the app for. -->
      <NuxtLink
        v-if="data.current"
        to="/workouts/current"
        class="flex items-center gap-3 rounded-lg border border-primary bg-primary/10 p-3"
      >
        <UIcon name="i-lucide-dumbbell" class="size-6 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="font-medium">
            Séance en cours : {{ data.current.name ?? 'Séance libre' }}
          </p>
          <p class="text-sm text-muted">
            Commencée {{ formatDay(data.current.startedAt) }} à
            {{ new Date(data.current.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}
          </p>
        </div>
        <span class="text-sm font-medium text-primary">Reprendre</span>
      </NuxtLink>

      <!-- Headline numbers: tiles, not charts. -->
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg border border-default p-3">
          <p class="text-xs text-muted">
            Cette semaine
          </p>
          <p class="text-lg font-bold tabular-nums">
            {{ data.week.sessions }}<span class="text-sm font-normal text-muted">/{{ data.week.goal }}</span>
          </p>
          <UProgress :model-value="weekProgress" size="xs" class="mt-1" :aria-label="`${data.week.sessions} séances sur ${data.week.goal}`" />
        </div>
        <div class="rounded-lg border border-default p-3">
          <p class="text-xs text-muted">
            Série
          </p>
          <p class="text-lg font-bold tabular-nums">
            {{ data.streak }} <span class="text-sm font-normal text-muted">sem.</span>
          </p>
          <p class="text-xs text-muted">
            d'affilée
          </p>
        </div>
        <div class="rounded-lg border border-default p-3">
          <p class="text-xs text-muted">
            Total soulevé
          </p>
          <p class="text-lg font-bold tabular-nums">
            {{ totalLifted }}
          </p>
          <p class="text-xs text-muted">
            depuis le début
          </p>
        </div>
      </div>

      <section class="rounded-lg border border-default p-3">
        <AttendanceCalendar :days="data.days" :today="data.today" />
      </section>

      <section class="space-y-2">
        <h2 class="font-medium">
          Séries par muscle
        </h2>
        <p class="text-xs text-muted">
          Séries de travail des 4 dernières semaines (échauffements exclus).
        </p>
        <p v-if="!data.muscles.length" class="text-sm text-muted">
          Aucune série sur cette période.
        </p>
        <StatChart
          v-else
          type="bar"
          horizontal
          :labels="data.muscles.map(m => MUSCLE_GROUP_LABELS[m.muscleGroup])"
          :values="data.muscles.map(m => m.sets)"
          unit="séries"
          :height="muscleChartHeight"
        />
      </section>

      <section class="space-y-2">
        <h2 class="font-medium">
          Records récents
        </h2>
        <p v-if="!data.recentPrs.length" class="text-sm text-muted">
          Aucun record ces 30 derniers jours.
        </p>
        <ul v-else class="divide-y divide-default rounded-lg border border-default">
          <li v-for="pr in data.recentPrs" :key="`${pr.workoutId}-${pr.exerciseId}-${pr.weightKg}-${pr.reps}`">
            <NuxtLink :to="`/exercises/${pr.exerciseId}`" class="flex items-center gap-3 p-3">
              <UIcon name="i-lucide-trophy" class="size-5 shrink-0 text-primary" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ pr.exerciseName }}
                </p>
                <p class="text-sm text-muted">
                  {{ formatWeight(pr.weightKg) }} × {{ pr.reps }} · {{ pr.types.map(t => PR_TYPE_LABELS[t]).join(', ') }}
                </p>
              </div>
              <span class="text-xs text-muted">{{ formatDay(pr.startedAt) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
