<!-- Login page: email + password, plus a one-click demo login for the portfolio. -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Connexion' })

const state = reactive({ email: '', password: '' })
const { loading, error, submit } = useAuthSubmit()

/**
 * Sends the validated form to the login route.
 *
 * @param event - Form submit event; `event.data` is the Zod-parsed output
 *   (email already trimmed and lowercased).
 */
function onSubmit(event: FormSubmitEvent<LoginInput>) {
  return submit('/api/auth/login', event.data)
}

/** Logs into the public demo account. */
function tryDemo() {
  return submit('/api/auth/demo')
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-1 text-center">
      <h1 class="text-2xl font-bold">
        Rep
      </h1>
      <p class="text-muted">
        Connectez-vous pour suivre vos séances.
      </p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

    <UForm :schema="loginSchema" :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="Email" name="email">
        <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>
      <UFormField label="Mot de passe" name="password">
        <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
      </UFormField>
      <UButton type="submit" block :loading="loading">
        Se connecter
      </UButton>
    </UForm>

    <USeparator label="ou" />

    <UButton block color="neutral" variant="outline" icon="i-lucide-eye" :disabled="loading" @click="tryDemo">
      Essayer la démo
    </UButton>

    <p class="text-center text-sm text-muted">
      Pas encore de compte ?
      <ULink to="/register" class="font-medium text-primary">
        Créer un compte
      </ULink>
    </p>
  </div>
</template>
