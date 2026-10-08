<!--
  Admin page: lists the accounts and deletes them. Reached from the account
  menu; the auth middleware keeps non-admins out, and the API checks it again.
-->
<script setup lang="ts">
useHead({ title: 'Administration' })

const { user: me } = useUserSession()
const toast = useToast()
const { data: users, status, refresh } = await useFetch('/api/admin/users')

/** Labels of the roles, as shown in the badges. */
const roleLabels = { admin: 'Admin', demo: 'Démo', user: 'Utilisateur' } as const

// Deletion is a two-step click (no browser confirm() popup): the first click
// arms the button of that row, the second one deletes.
const armedId = ref<number | null>(null)
const deletingId = ref<number | null>(null)

/**
 * Handles a click on a row's delete button.
 *
 * @param id - Account to delete.
 */
async function onDelete(id: number) {
  if (armedId.value !== id) {
    armedId.value = id
    return
  }
  armedId.value = null
  deletingId.value = id
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Compte supprimé', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">
      Administration
    </h1>

    <p v-if="status === 'error'" class="text-error">
      Impossible de charger les comptes.
    </p>

    <ul v-else class="divide-y divide-default rounded-lg border border-default">
      <li v-for="account in users" :key="account.id" class="flex items-center gap-3 p-3">
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">
            {{ account.email }}
          </p>
          <p class="text-xs text-muted">
            Créé le {{ new Date(account.createdAt).toLocaleDateString('fr-FR') }}
          </p>
        </div>
        <UBadge :color="account.role === 'admin' ? 'primary' : 'neutral'" variant="subtle">
          {{ roleLabels[account.role] }}
        </UBadge>
        <!-- No delete button on one's own row: the API refuses it anyway. -->
        <UButton
          v-if="account.id !== me?.id"
          :color="armedId === account.id ? 'error' : 'neutral'"
          :variant="armedId === account.id ? 'solid' : 'ghost'"
          icon="i-lucide-trash-2"
          :loading="deletingId === account.id"
          :aria-label="`Supprimer ${account.email}`"
          @click="onDelete(account.id)"
        >
          <template v-if="armedId === account.id">
            Confirmer
          </template>
        </UButton>
      </li>
    </ul>
  </div>
</template>
