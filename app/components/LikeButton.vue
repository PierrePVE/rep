<!--
  "Bravo" button of a session, Strava-kudos style, with its counter.
  Optimistic: the count changes at once and is put back if the call fails.
-->
<script setup lang="ts">
const props = defineProps<{
  /** The liked session. */
  workoutId: number
}>()

/** Number of likes, kept in sync with the parent. */
const likeCount = defineModel<number>('likeCount', { required: true })
/** Whether the current user liked it. */
const likedByMe = defineModel<boolean>('likedByMe', { required: true })

const toast = useToast()
const busy = ref(false)

/** Likes or unlikes, then takes the server's count (others may have liked meanwhile). */
async function toggle() {
  // Ignores taps while a call is in flight: two quick taps would otherwise
  // race and leave the counter wrong.
  if (busy.value) return
  busy.value = true
  const wasLiked = likedByMe.value
  likedByMe.value = !wasLiked
  likeCount.value += wasLiked ? -1 : 1
  try {
    const res = await $fetch(`/api/workouts/${props.workoutId}/like`, { method: wasLiked ? 'DELETE' : 'PUT' })
    likeCount.value = res.likeCount
    likedByMe.value = res.likedByMe
  }
  catch (e) {
    likedByMe.value = wasLiked
    likeCount.value += wasLiked ? 1 : -1
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UButton
    :icon="likedByMe ? 'i-lucide-heart-handshake' : 'i-lucide-hand-heart'"
    :color="likedByMe ? 'primary' : 'neutral'"
    :variant="likedByMe ? 'soft' : 'ghost'"
    size="sm"
    :aria-pressed="likedByMe"
    :aria-label="likedByMe ? 'Retirer mon bravo' : 'Dire bravo'"
    @click.prevent.stop="toggle"
  >
    Bravo{{ likeCount ? ` · ${likeCount}` : '' }}
  </UButton>
</template>
