<!--
  Profile of a user: username, follower counts, follow button, and their
  sessions when the current user may see them (an accepted follow, or their
  own profile). Otherwise the sessions stay hidden, as on a private profile.
-->
<script setup lang="ts">
const route = useRoute()
const username = String(route.params.username)
const { user } = useUserSession()

const ready = computed(() => user.value?.role !== 'demo' && !!user.value?.username)
const { data: profile, error } = await useFetch(`/api/users/${username}`, { immediate: ready.value, watch: [ready] })

useHead({ title: () => `@${profile.value?.username ?? username}` })

// Local copy for the follow button, which updates it in place.
const followStatus = ref<FollowStatus | null>(null)
watch(profile, (value) => { followStatus.value = value?.followStatus ?? null }, { immediate: true })

const canSeeSessions = computed(() => profile.value?.isMe || followStatus.value === 'accepted')
</script>

<template>
  <div class="space-y-4">
    <UButton to="/feed" icon="i-lucide-arrow-left" label="Feed" color="neutral" variant="link" class="px-0" />

    <SocialGate>
      <p v-if="error || !profile" class="text-error">
        {{ error?.statusCode === 404 ? 'Utilisateur introuvable.' : 'Impossible de charger le profil.' }}
      </p>

      <template v-else>
        <div class="flex items-center gap-3">
          <div class="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xl font-semibold text-primary uppercase">
            {{ profile.username.charAt(0) }}
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-xl font-bold">
              @{{ profile.username }}
            </h1>
            <p class="text-sm text-muted">
              {{ profile.followers }} abonné{{ profile.followers > 1 ? 's' : '' }} · {{ profile.following }} abonnement{{ profile.following > 1 ? 's' : '' }}
            </p>
            <p v-if="profile.followsMe" class="text-xs text-muted">
              Vous suit
            </p>
          </div>
          <FollowButton v-if="!profile.isMe" v-model:status="followStatus" :username="profile.username" />
          <UButton v-else to="/people" label="Gérer" icon="i-lucide-settings" color="neutral" variant="subtle" size="sm" />
        </div>

        <!-- Keyed by the status, so the list loads as soon as a follow
             becomes visible (e.g. after following back). -->
        <FeedList v-if="canSeeSessions" :key="`${followStatus}`" :user="profile.username">
          <template #empty>
            <p class="text-muted">
              Aucune séance visible pour l'instant.
            </p>
          </template>
        </FeedList>

        <div v-else class="space-y-1 rounded-lg border border-default p-4 text-center">
          <UIcon name="i-lucide-lock" class="size-6 text-muted" />
          <p class="font-medium">
            Profil privé
          </p>
          <p class="text-sm text-muted">
            {{ followStatus === 'pending' ? 'Votre demande attend sa réponse.' : `Suivez @${profile.username} pour voir ses séances, s'il accepte.` }}
          </p>
        </div>
      </template>
    </SocialGate>
  </div>
</template>
