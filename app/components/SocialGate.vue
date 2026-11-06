<!--
  Gate of the social pages: renders its slot only for an account that can
  use the feed. The demo account gets an explanation (anyone can log into
  it), an account without a username is asked to pick one first: it is the
  only identity other users ever see.
-->
<script setup lang="ts">
const { user } = useUserSession()
</script>

<template>
  <div v-if="user?.role === 'demo'" class="space-y-2 rounded-lg border border-default p-4">
    <h2 class="font-semibold">
      Réservé aux comptes personnels
    </h2>
    <p class="text-sm text-muted">
      Le compte démo est partagé par tous les visiteurs : il ne peut ni suivre personne ni publier ses séances. Créez un compte pour rejoindre le feed.
    </p>
  </div>

  <div v-else-if="!user?.username" class="space-y-3 rounded-lg border border-default p-4">
    <div>
      <h2 class="font-semibold">
        Choisissez un pseudo
      </h2>
      <p class="text-sm text-muted">
        C'est le nom que verront vos abonnés. Votre email reste privé.
      </p>
    </div>
    <UsernameForm submit-label="Continuer" />
  </div>

  <slot v-else />
</template>
