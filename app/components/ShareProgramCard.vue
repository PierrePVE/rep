<!--
  Share block of the program page: creates a share link, copies it, and
  revokes it. Anyone logged in who has the link can preview the program and
  import a copy (see /programs/shared/:token). Demo accounts cannot share: the
  link would point to a shared account anyone can use.
-->
<script setup lang="ts">
const props = defineProps<{
  /** Id of the program to share. */
  programId: number
  /** Current share token, null when the program is not shared. */
  shareToken: string | null
}>()

const { user } = useUserSession()
const toast = useToast()
const isDemo = computed(() => user.value?.role === 'demo')

// Local copy of the token, so creating or revoking the link updates the block
// without reloading the whole program page. It follows the prop when the
// parent refreshes for another reason.
const token = ref(props.shareToken)
watch(() => props.shareToken, value => (token.value = value))

// useRequestURL works during SSR too, unlike window.location.
const origin = useRequestURL().origin
const link = computed(() => token.value ? `${origin}/programs/shared/${token.value}` : '')

const { pending: creating, run: runCreate } = useAction()
const { pending: revoking, run: runRevoke } = useAction()

/** Creates the link (the API returns the existing one if already shared). */
async function onCreate() {
  await runCreate(async () => {
    const res = await $fetch(`/api/programs/${props.programId}/share`, { method: 'POST' })
    token.value = res.shareToken
  })
}

/** Copies the link; the clipboard API needs a secure context and permission. */
async function onCopy() {
  try {
    await navigator.clipboard.writeText(link.value)
    toast.add({ title: 'Lien copié', color: 'success' })
  }
  catch {
    // Rare (plain-http LAN address, denied permission): the field stays
    // selectable, so the user can still copy it by hand.
    toast.add({ title: 'Copie impossible, sélectionnez le lien à la main', color: 'warning' })
  }
}

// Two-step revoke, like the delete buttons: a revoked link cannot be restored
// (a new one gets a new token), so a stray tap must not do it.
const revokeArmed = ref(false)

/** Arms the revoke button, or revokes the link if it was already armed. */
async function onRevoke() {
  if (!revokeArmed.value) {
    revokeArmed.value = true
    return
  }
  revokeArmed.value = false
  const ok = await runRevoke(
    async () => { await $fetch(`/api/programs/${props.programId}/share`, { method: 'DELETE' }) },
    'Lien révoqué',
  )
  if (ok) token.value = null
}
</script>

<template>
  <section class="space-y-2 rounded-lg border border-default p-3">
    <h2 class="flex items-center gap-2 font-semibold">
      <UIcon name="i-lucide-share-2" class="size-4" />
      Partage
    </h2>

    <p v-if="isDemo" class="text-sm text-muted">
      Le partage est réservé aux comptes personnels. Créez un compte pour partager vos programmes.
    </p>

    <template v-else-if="!token">
      <p class="text-sm text-muted">
        Créez un lien pour qu'une autre personne ayant un compte puisse importer une copie de ce programme.
      </p>
      <UButton
        label="Créer un lien de partage"
        icon="i-lucide-link"
        color="neutral"
        variant="subtle"
        :loading="creating"
        @click="onCreate"
      />
    </template>

    <template v-else>
      <p class="text-sm text-muted">
        Les personnes qui ont ce lien peuvent importer une copie. Vos modifications ultérieures ne changent pas leur copie.
      </p>
      <div class="flex gap-2">
        <!-- Read-only but selectable: the fallback when the clipboard fails. -->
        <UInput
          :model-value="link"
          readonly
          class="min-w-0 flex-1"
          aria-label="Lien de partage"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <UButton icon="i-lucide-copy" aria-label="Copier le lien" @click="onCopy" />
      </div>
      <UButton
        :color="revokeArmed ? 'error' : 'neutral'"
        :variant="revokeArmed ? 'solid' : 'ghost'"
        icon="i-lucide-link-2-off"
        size="sm"
        :loading="revoking"
        @click="onRevoke"
      >
        {{ revokeArmed ? 'Confirmer la révocation' : 'Révoquer le lien' }}
      </UButton>
    </template>
  </section>
</template>
