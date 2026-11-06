<!--
  Modal to add an exercise of the user's catalogue to a session (the one in
  progress, or a past one from the history). Not optimistic, like the
  addExercise action it calls: it stays open with a spinner until the API
  answers, and stays open on failure (the action shows the toast) to retry.

  Props:
  - add: performs the call with the picked exercise id and resolves to
    whether it worked (WorkoutEditor['addExercise']).
  v-model:open: whether the modal is shown.
-->
<script setup lang="ts">
const props = defineProps<{
  add: (exerciseId: number) => Promise<boolean>
}>()

const open = defineModel<boolean>('open', { default: false })

// The catalogue for the picker. Lazy and client-only: only needed once the
// modal opens, and the page must not wait for it.
const { data: catalogue } = useFetch('/api/exercises', { lazy: true, server: false, default: () => [] })

const exerciseId = ref<number | undefined>(undefined)
const adding = ref(false)

// Cleared each time the modal opens, so the exercise picked last time is not
// added twice by mistake.
watch(open, (isOpen) => {
  if (isOpen) exerciseId.value = undefined
})

/** Adds the picked exercise, closing the modal once it is saved. */
async function onAdd() {
  if (exerciseId.value === undefined) return
  adding.value = true
  if (await props.add(exerciseId.value)) open.value = false
  adding.value = false
}
</script>

<template>
  <UModal v-model:open="open" title="Ajouter un exercice">
    <template #body>
      <div class="space-y-4">
        <!-- Searchable: the catalogue holds dozens of exercises. -->
        <USelectMenu
          v-model="exerciseId"
          :items="catalogue"
          value-key="id"
          label-key="name"
          placeholder="Choisir un exercice"
          :search-input="{ placeholder: 'Rechercher…' }"
          class="w-full"
        />
        <UButton
          label="Ajouter"
          block
          :disabled="exerciseId === undefined"
          :loading="adding"
          @click="onAdd"
        />
      </div>
    </template>
  </UModal>
</template>
