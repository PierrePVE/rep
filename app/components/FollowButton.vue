<!--
  Follow button of a user: "Suivre" sends a request, "Demandé" cancels it,
  "Abonné" unfollows after a confirmation tap (following again needs a new
  request, so a stray tap must not do it).
-->
<script setup lang="ts">
const props = defineProps<{
  /** The user to follow. */
  username: string
}>()

/** The current user's follow of them, kept in sync with the parent. */
const status = defineModel<FollowStatus | null>('status', { required: true })

const toast = useToast()
const busy = ref(false)
const unfollowArmed = ref(false)

/** Follows, cancels the request, or (after arming) unfollows. */
async function onClick() {
  if (status.value === 'accepted' && !unfollowArmed.value) {
    unfollowArmed.value = true
    return
  }
  unfollowArmed.value = false
  busy.value = true
  try {
    if (status.value === null) {
      const res = await $fetch(`/api/users/${props.username}/follow`, { method: 'POST' })
      status.value = res.followStatus
      toast.add({ title: 'Demande envoyée', color: 'success' })
    }
    else {
      await $fetch(`/api/users/${props.username}/follow`, { method: 'DELETE' })
      status.value = null
    }
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = false
  }
}

/** Label and look of each state. */
const look = computed(() => {
  if (status.value === 'accepted') {
    return unfollowArmed.value
      ? { label: 'Ne plus suivre', color: 'error' as const, variant: 'solid' as const, icon: 'i-lucide-user-minus' }
      : { label: 'Abonné', color: 'neutral' as const, variant: 'subtle' as const, icon: 'i-lucide-user-check' }
  }
  if (status.value === 'pending') {
    return { label: 'Demandé', color: 'neutral' as const, variant: 'subtle' as const, icon: 'i-lucide-clock' }
  }
  return { label: 'Suivre', color: 'primary' as const, variant: 'solid' as const, icon: 'i-lucide-user-plus' }
})
</script>

<template>
  <UButton
    :label="look.label"
    :icon="look.icon"
    :color="look.color"
    :variant="look.variant"
    size="sm"
    :loading="busy"
    @click="onClick"
  />
</template>
