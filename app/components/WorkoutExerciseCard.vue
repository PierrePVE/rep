<!--
  One exercise of the session in progress, on the logging screen: its name,
  program targets and sets, with the buttons to log, edit and delete sets.

  The set calls go through useCurrentWorkout, whose state is shared, so the
  card changes the session directly instead of emitting events to the page.

  Props:
  - item: the workout exercise, with its sets (from useCurrentWorkout).
  - plan: its program targets, or undefined for an exercise outside the plan.
-->
<script setup lang="ts">
import type { CurrentWorkout, WorkoutExercise, WorkoutSet } from '~/composables/useCurrentWorkout'

type PlanEntry = CurrentWorkout['plan'][number]

const props = defineProps<{
  item: WorkoutExercise
  plan?: PlanEntry
}>()

const { addSet, updateSet, removeSet } = useCurrentWorkout()
const toast = useToast()

/**
 * Formats the targets as "3 × 8–12", with a single number when the range is
 * one value ("3 × 5"), as on the program page.
 *
 * @param plan - Targets of the exercise.
 * @returns The text to show.
 */
function formatTarget(plan: PlanEntry) {
  const reps = plan.repMin === plan.repMax ? plan.repMin : `${plan.repMin}–${plan.repMax}`
  return plan.targetRpe ? `${plan.targetSets} × ${reps} @ RPE ${plan.targetRpe}` : `${plan.targetSets} × ${reps}`
}

/**
 * Formats the load of a set: "PDC" (poids du corps) for 0 kg, which is how
 * bodyweight sets are logged, else the weight with a French decimal comma.
 *
 * @param weightKg - Weight of the set.
 * @returns The text to show.
 */
function formatWeight(weightKg: number) {
  return weightKg === 0 ? 'PDC' : `${weightKg.toLocaleString('fr-FR')} kg`
}

// One modal for both modes: `editedSet` is the set being edited, or null when
// logging a new one.
const modalOpen = ref(false)
const editedSet = ref<WorkoutSet | null>(null)

/**
 * Values the modal opens with. When editing, the set itself. When logging,
 * a copy of the previous set of the exercise, since most sets repeat the
 * same load; for the first set, the low end of the planned rep range and no
 * weight (the user must type it).
 */
const modalInitial = computed(() => {
  const source = editedSet.value ?? props.item.sets.at(-1)
  if (source) return { weightKg: source.weightKg, reps: source.reps, rpe: source.rpe, type: source.type }
  return { reps: props.plan?.repMin }
})

/** Opens the modal to log a new set. */
function openAdd() {
  editedSet.value = null
  modalOpen.value = true
}

/**
 * Opens the modal to edit a set. Ignored for a set the API has not confirmed
 * yet: its id is temporary, so a PATCH or DELETE would hit nothing.
 *
 * @param set - The set tapped.
 */
function openEdit(set: WorkoutSet) {
  if (set.id < 0) return
  editedSet.value = set
  modalOpen.value = true
}

/**
 * Celebrates the records a set beat, if any.
 *
 * @param prs - Records returned by the API (null when the call failed).
 */
function announcePrs(prs: PrType[] | null) {
  if (!prs?.length) return
  toast.add({
    title: 'Nouveau record !',
    description: prs.map(pr => PR_TYPE_LABELS[pr]).join(' · '),
    icon: 'i-lucide-trophy',
    color: 'success',
  })
}

/**
 * Saves the modal's set: a new one, or the changes to the edited one. Not
 * awaited by the modal, which is already closed (the calls are optimistic).
 *
 * @param input - The validated set.
 */
async function onSubmit(input: SetInput) {
  const edited = editedSet.value
  announcePrs(edited ? await updateSet(edited.id, input) : await addSet(props.item.id, input))
}

/** Deletes the edited set, once the user confirmed it in the modal. */
function onRemove() {
  if (editedSet.value) removeSet(editedSet.value.id)
}
</script>

<template>
  <section class="rounded-lg border border-default">
    <header class="border-b border-default p-3">
      <h2 class="font-medium">
        {{ item.exercise.name }}
      </h2>
      <p class="text-sm text-muted">
        {{ MUSCLE_GROUP_LABELS[item.exercise.muscleGroup] }}
        <template v-if="plan">
          · Objectif {{ formatTarget(plan) }}
        </template>
      </p>
    </header>

    <ol v-if="item.sets.length" class="divide-y divide-default">
      <li v-for="(set, index) in item.sets" :key="set.id">
        <!-- The whole row is the edit button: easier to hit than a small
             icon with sweaty hands. Disabled while the set is unconfirmed. -->
        <button
          type="button"
          class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm disabled:opacity-50"
          :disabled="set.id < 0"
          @click="openEdit(set)"
        >
          <span class="w-5 text-muted">{{ index + 1 }}</span>
          <span class="font-medium">{{ formatWeight(set.weightKg) }} × {{ set.reps }}</span>
          <span v-if="set.rpe" class="text-muted">RPE {{ set.rpe.toLocaleString('fr-FR') }}</span>
          <UBadge v-if="SET_TYPE_LABELS[set.type]" color="neutral" variant="subtle" size="sm">
            {{ SET_TYPE_LABELS[set.type] }}
          </UBadge>
          <!-- Only known for the sets logged or edited during this visit
               (see WorkoutSet in useCurrentWorkout). -->
          <UBadge v-if="set.prs?.length" color="success" variant="subtle" size="sm" icon="i-lucide-trophy">
            PR
          </UBadge>
        </button>
      </li>
    </ol>

    <div class="p-2">
      <UButton
        label="Ajouter une série"
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        block
        @click="openAdd"
      />
    </div>

    <SetModal
      v-model:open="modalOpen"
      :title="editedSet ? 'Modifier la série' : `Série ${item.sets.length + 1}`"
      :submit-label="editedSet ? 'Enregistrer' : 'Ajouter'"
      :initial="modalInitial"
      :editing="editedSet !== null"
      @submit="onSubmit"
      @remove="onRemove"
    />
  </section>
</template>
