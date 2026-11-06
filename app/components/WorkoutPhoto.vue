<!--
  Photo block of a session, Strava-style: shows the photo, and lets the owner
  add one (camera or gallery, the phone offers both), replace it or remove it.
  The picture is shrunk in the browser before upload (see shrinkPhoto).
  Not available on the demo account, which anyone can log into.
-->
<script setup lang="ts">
const props = defineProps<{
  /** The session the photo belongs to. */
  workoutId: number
}>()

/** URL of the current photo (versioned), null when there is none. */
const photoUrl = defineModel<string | null>('photoUrl', { required: true })

const { user } = useUserSession()
const isDemo = computed(() => user.value?.role === 'demo')
const toast = useToast()

const input = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

/** Opens the system picker (camera or gallery). */
function pick() {
  input.value?.click()
}

/**
 * Shrinks and uploads the picked picture, then shows it.
 *
 * @param event - Change event of the hidden file input.
 */
async function onPicked(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  // Reset, so picking the same file again still fires a change event.
  target.value = ''
  if (!file) return

  uploading.value = true
  let blob: Blob
  try {
    blob = await shrinkPhoto(file)
  }
  catch {
    // Usually a HEIC picture on a browser that cannot decode it.
    toast.add({ title: 'Impossible de lire cette image, essayez une photo JPEG', color: 'error' })
    uploading.value = false
    return
  }
  try {
    const res = await $fetch(`/api/workouts/${props.workoutId}/photo`, {
      method: 'PUT',
      body: blob,
      headers: { 'content-type': blob.type },
    })
    photoUrl.value = res.photoUrl
    toast.add({ title: 'Photo ajoutée', color: 'success' })
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error), color: 'error' })
  }
  finally {
    uploading.value = false
  }
}

// Two-step removal, like the other deletions.
const removeArmed = ref(false)
const { pending: removing, run: runRemove } = useAction()

/** Arms the remove button, or removes the photo if it was already armed. */
async function onRemove() {
  if (!removeArmed.value) {
    removeArmed.value = true
    return
  }
  removeArmed.value = false
  const ok = await runRemove(
    async () => { await $fetch(`/api/workouts/${props.workoutId}/photo`, { method: 'DELETE' }) },
    'Photo retirée',
  )
  if (ok) photoUrl.value = null
}
</script>

<template>
  <section v-if="!isDemo" class="space-y-2">
    <!-- No `capture` attribute: it would force the camera, while the plain
         picker lets the phone offer both the camera and the gallery. -->
    <input
      ref="input"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onPicked"
    >

    <template v-if="photoUrl">
      <img :src="photoUrl" alt="Photo de la séance" class="max-h-[28rem] w-full rounded-lg object-cover">
      <div class="flex gap-2">
        <UButton
          label="Changer"
          icon="i-lucide-camera"
          color="neutral"
          variant="subtle"
          size="sm"
          :loading="uploading"
          @click="pick"
        />
        <UButton
          :label="removeArmed ? 'Confirmer' : 'Retirer'"
          icon="i-lucide-trash-2"
          :color="removeArmed ? 'error' : 'neutral'"
          :variant="removeArmed ? 'solid' : 'ghost'"
          size="sm"
          :loading="removing"
          @click="onRemove"
        />
      </div>
    </template>

    <!-- A wide dashed drop zone rather than a small button: it is the main
         call to action right after finishing a session. -->
    <button
      v-else
      type="button"
      class="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-accented p-6 text-muted hover:bg-elevated disabled:opacity-60"
      :disabled="uploading"
      @click="pick"
    >
      <UIcon :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-camera'" class="size-6" :class="{ 'animate-spin': uploading }" />
      <span class="text-sm font-medium">{{ uploading ? 'Envoi…' : 'Ajouter une photo' }}</span>
    </button>
  </section>
</template>
