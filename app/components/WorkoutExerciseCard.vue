<!--
  One exercise of a session: its name, program targets and sets, with the
  buttons to log, edit and delete sets and to remove the exercise. Used on the
  logging screen (the session in progress) and on the history detail page.

  The calls go through the `editor` actions, which change the session state
  in place, so the card needs no events back to the page.

  Props:
  - item: the workout exercise, with its sets.
  - plan: its program targets, or undefined for an exercise outside the plan.
  - editor: the editing actions of the session (useCurrentWorkout or
    useWorkoutEditor).
  - live: true for the session in progress. Only then does the card show what
    was done last time (for a past session, "last time" would be a later one)
    and start the rest timer after a new set.
-->
<script setup lang="ts">
import type { CurrentWorkout, WorkoutEditor, WorkoutExercise, WorkoutSet } from '~/composables/useCurrentWorkout'

type PlanEntry = CurrentWorkout['plan'][number]

const props = defineProps<{
  item: WorkoutExercise
  plan?: PlanEntry
  editor: WorkoutEditor
  live?: boolean
}>()

const { addSet, updateSet, removeSet, removeExercise } = props.editor
const toast = useToast()
const restTimer = useRestTimer()

// Last finished session with this exercise, for the reminder and the prefill.
// Lazy: the card shows at once and the reminder fills in when it arrives,
// since it is a hint, not something the logging must wait for. Keyed by
// exercise, so two cards of the same exercise share one request.
// `immediate: false` off the logging screen: the request is never sent.
const { data: lastData } = useFetch(() => `/api/exercises/${props.item.exerciseId}/last`, {
  key: `exercise-last-${props.item.exerciseId}`,
  lazy: true,
  immediate: props.live,
})
const last = computed(() => (props.live ? lastData.value?.last ?? null : null))

/** Date of the last session, e.g. "lun. 27 oct.". */
const lastDate = computed(() => last.value ? formatDay(last.value.startedAt) : '')

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

// One modal for both modes: `editedSet` is the set being edited, or null when
// logging a new one.
const modalOpen = ref(false)
const editedSet = ref<WorkoutSet | null>(null)

/**
 * Values the modal opens with. When editing, the set itself. When logging,
 * a copy of the previous set of the exercise, since most sets repeat the
 * same load. For the first set, the first work set of last time (warm-ups
 * are skipped: they would prefill a load far below the real one), else the
 * low end of the planned rep range and no weight (the user must type it).
 */
const modalInitial = computed(() => {
  const source = editedSet.value
    ?? props.item.sets.at(-1)
    ?? last.value?.sets.find(s => s.type === 'normal')
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
  if (edited) {
    announcePrs(await updateSet(edited.id, input))
    return
  }
  // Started before the API call: the rest begins when the set is done, not
  // when the network answers. Only a new set starts it, not a correction.
  if (props.live) restTimer.start(props.plan?.restSeconds ?? DEFAULT_REST_SECONDS)
  announcePrs(await addSet(props.item.id, input))
}

// Removing the exercise deletes its sets too, so it takes two taps, as the
// other deletions of the app.
const removeArmed = ref(false)

/** First tap arms the remove button, the second one removes the exercise. */
function onRemoveExercise() {
  if (!removeArmed.value) {
    removeArmed.value = true
    return
  }
  removeExercise(props.item.id)
}

/** Deletes the edited set, once the user confirmed it in the modal. */
function onRemove() {
  if (editedSet.value) removeSet(editedSet.value.id)
}
</script>

<template>
  <section class="rounded-lg border border-default">
    <header class="border-b border-default p-3">
      <div class="flex items-start gap-2">
        <h2 class="min-w-0 flex-1 font-medium">
          {{ item.exercise.name }}
        </h2>
        <!-- Once armed, the button spells out what the next tap does. -->
        <UButton
          :icon="removeArmed ? undefined : 'i-lucide-trash-2'"
          :label="removeArmed ? 'Retirer ?' : undefined"
          :color="removeArmed ? 'error' : 'neutral'"
          :variant="removeArmed ? 'solid' : 'ghost'"
          size="xs"
          :aria-label="`Retirer ${item.exercise.name} de la séance`"
          @click="onRemoveExercise"
          @blur="removeArmed = false"
        />
      </div>
      <p class="text-sm text-muted">
        {{ MUSCLE_GROUP_LABELS[item.exercise.muscleGroup] }}
        <template v-if="plan">
          · Objectif {{ formatTarget(plan) }}
        </template>
      </p>
      <!-- Warm-ups are left out: the point is to know which load to beat. -->
      <p v-if="last" class="mt-1 text-xs text-muted">
        <UIcon name="i-lucide-history" class="size-3 align-[-1px]" />
        {{ lastDate }} :
        {{ last.sets.filter(s => s.type !== 'warmup').map(s => `${formatWeight(s.weightKg)} × ${s.reps}`).join(' · ') }}
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
