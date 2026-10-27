<!-- Sign-up page: creates the account, which comes with the base exercise catalogue. -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Créer un compte' })

const state = reactive({ email: '', password: '' })
const { loading, error, submit } = useAuthSubmit()

/**
 * Sends the validated form to the sign-up route.
 *
 * @param event - Form submit event; `event.data` is the Zod-parsed output.
 */
function onSubmit(event: FormSubmitEvent<RegisterInput>) {
  return submit('/api/auth/register', event.data)
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-1 text-center">
      <h1 class="text-2xl font-bold">
        Créer un compte
      </h1>
      <p class="text-muted">
        Les exercices de base sont ajoutés automatiquement.
      </p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

    <UForm :schema="registerSchema" :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="Email" name="email">
        <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UFormField label="Mot de passe" name="password" help="8 caractères minimum">
        <!-- new-password: lets password managers suggest a strong one. -->
        <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UButton type="submit" block :loading="loading">
        Créer mon compte
      </UButton>
    </UForm>

    <p class="text-center text-sm text-muted">
      Déjà un compte ?
      <ULink to="/login" class="font-medium text-primary">
        Se connecter
      </ULink>
    </p>
  </div>
</template>
