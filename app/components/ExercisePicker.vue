<!--
  Searchable picker of the user's exercises, which can also create one: when
  the search finds nothing, a "Créer « … »" entry opens the exercise form with
  the typed name, and the new exercise is added to the catalogue and picked.
  So a missing exercise never forces the user to leave the program editor or
  the session for the library page.

  The catalogue (active exercises) is loaded here, under one shared key: every
  picker of the app reads and updates the same list, and an exercise created
  from one shows up in the others.

  v-model: id of the picked exercise (undefined while nothing is picked).
-->
<script setup lang="ts">
const model = defineModel<number | undefined>()

// Lazy and client-only: the list only matters once the user opens a picker,
// and the page around it must not wait for it.
const { data: catalogue } = useFetch('/api/exercises', {
  key: 'exercise-catalogue',
  lazy: true,
  server: false,
  default: () => [],
})

const createOpen = ref(false)
const createName = ref('')

/**
 * Opens the exercise form for the search term, when the user picks the
 * "Créer « … »" entry.
 *
 * @param name - What was typed in the search field.
 */
function onCreate(name: string) {
  createName.value = name.trim()
  createOpen.value = true
}

/**
 * Creates the exercise, adds it to the shared catalogue and picks it. Throws
 * on failure (e.g. 409 for a name already taken by an archived exercise), so
 * ExerciseModal shows the message and stays open.
 *
 * @param input - The validated form values.
 */
async function create(input: ExerciseInput) {
  const { exercise } = await $fetch('/api/exercises', { method: 'POST', body: input })
  // Kept sorted by name, like the API returns it.
  catalogue.value = [...catalogue.value, exercise].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  model.value = exercise.id
}
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="catalogue"
    value-key="id"
    label-key="name"
    placeholder="Choisir un exercice"
    :search-input="{ placeholder: 'Rechercher ou créer…' }"
    create-item
    class="w-full"
    @create="onCreate"
  />

  <!-- Opened over the modal that holds the picker; closing it goes back
       there with the new exercise picked. -->
  <ExerciseModal
    v-model:open="createOpen"
    title="Nouvel exercice"
    submit-label="Créer"
    :initial-name="createName"
    :save="create"
  />
</template>
