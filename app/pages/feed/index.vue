<!--
  Social feed, Strava-style for the gym: the user's own finished sessions and
  those of the people they follow, newest first. Links to the community page
  (find people, follow requests), with a badge when requests are waiting.
-->
<script setup lang="ts">
useHead({ title: 'Feed' })

const { user } = useUserSession()

// The pending requests badge; only fetched once the gate lets the page in
// (the demo account and accounts without a username would get an error).
const ready = computed(() => user.value?.role !== 'demo' && !!user.value?.username)
const { data: profile } = await useFetch('/api/profile', { immediate: ready.value, watch: [ready] })
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <h1 class="flex-1 text-2xl font-bold">
        Feed
      </h1>
      <UChip v-if="ready" :show="!!profile?.pendingRequests" :text="profile?.pendingRequests" size="3xl">
        <UButton to="/people" icon="i-lucide-users" label="Communauté" color="neutral" variant="subtle" />
      </UChip>
    </div>

    <SocialGate>
      <FeedList>
        <template #empty>
          <div class="space-y-2 rounded-lg border border-dashed border-accented p-6 text-center">
            <p class="font-medium">
              Votre feed est vide
            </p>
            <p class="text-sm text-muted">
              Terminez une séance ou suivez des amis pour voir leurs séances ici.
            </p>
            <UButton to="/people" label="Trouver des amis" icon="i-lucide-user-plus" />
          </div>
        </template>
      </FeedList>
    </SocialGate>
  </div>
</template>
