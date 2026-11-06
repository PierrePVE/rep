<!--
  Form to pick or change the username (PATCH /api/profile). On success it
  refreshes the session, so every page sees the new username at once.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Current username, prefilled when changing it. */
  initial?: string | null
  /** Label of the submit button. */
  submitLabel?: string
}>(), { initial: null, submitLabel: 'Enregistrer' })

const emit = defineEmits<{
  /** The username was saved; gives the stored (lowercased) value. */
  saved: [username: string]
}>()

const { fetch: refreshSession } = useUserSession()
const toast = useToast()

const username = ref(props.initial ?? '')
const error = ref<string | null>(null)
const saving = ref(false)

/** Validates locally (same schema as the API), then saves. */
async function onSubmit() {
  const parsed = usernameSchema.safeParse(username.value)
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Pseudo invalide'
    return
  }
  error.value = null
  saving.value = true
  try {
    const res = await $fetch('/api/profile', { method: 'PATCH', body: { username: parsed.data } })
    await refreshSession()
    username.value = res.username
    toast.add({ title: 'Pseudo enregistré', color: 'success' })
    emit('saved', res.username)
  }
  catch (e) {
    // Shown under the field: usually "already taken", fixed by typing another.
    error.value = apiErrorMessage(e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-2" @submit.prevent="onSubmit">
    <UFormField :error="error ?? undefined" label="Pseudo" name="username">
      <UInput
        v-model="username"
        placeholder="pierre.muscu"
        autocomplete="username"
        autocapitalize="none"
        :maxlength="20"
        class="w-full"
      >
        <template #leading>
          <span class="text-muted">@</span>
        </template>
      </UInput>
    </UFormField>
    <UButton type="submit" :label="submitLabel" :loading="saving" />
  </form>
</template>
