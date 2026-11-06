<!--
  Community page: the user's username, a search to find people to follow,
  the follow requests waiting for an answer, and the lists of followers and
  followed users, each with its action (accept, refuse, remove, unfollow).
-->
<script setup lang="ts">
useHead({ title: 'Communauté' })

const { user } = useUserSession()
const toast = useToast()
const ready = computed(() => user.value?.role !== 'demo' && !!user.value?.username)

// Fetched only once the gate lets the page in; `watch: [ready]` loads them
// right after the user picks a username on this very page.
const fetchOptions = { immediate: ready.value, watch: [ready] }
const { data: requests, refresh: refreshRequests } = await useFetch('/api/follow-requests', fetchOptions)
const { data: followers, refresh: refreshFollowers } = await useFetch('/api/followers', fetchOptions)
const { data: following } = await useFetch('/api/following', fetchOptions)

// --- Search ---

const q = ref('')
const results = ref<Array<{ username: string, followStatus: FollowStatus | null }>>([])
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
// Counter so a slow answer to an old query never overwrites a newer one.
let searchId = 0

// Debounced: one request once the user pauses typing, not one per key.
watch(q, (value) => {
  clearTimeout(searchTimer)
  const term = value.trim()
  if (term.length < 2) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    const current = ++searchId
    searching.value = true
    try {
      const found = await $fetch('/api/users', { query: { q: term } })
      if (current === searchId) results.value = found
    }
    catch (e) {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
    finally {
      if (current === searchId) searching.value = false
    }
  }, 300)
})

// --- Requests and followers ---

/** Which row shows a spinner; one action at a time is enough here. */
const busy = ref<string | null>(null)

/**
 * Accepts or refuses a follow request, then reloads the affected lists.
 *
 * @param username - Who asked.
 * @param accept - true to accept, false to refuse.
 */
async function answer(username: string, accept: boolean) {
  busy.value = username
  try {
    if (accept) await $fetch(`/api/follow-requests/${username}/accept`, { method: 'POST' })
    else await $fetch(`/api/followers/${username}`, { method: 'DELETE' })
    await Promise.all([refreshRequests(), refreshFollowers()])
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

// Removing a follower is a two-step click, like the other deletions.
const armedFollower = ref<string | null>(null)

/**
 * Arms the remove button of a follower, or removes them if already armed.
 *
 * @param username - The follower.
 */
async function removeFollower(username: string) {
  if (armedFollower.value !== username) {
    armedFollower.value = username
    return
  }
  armedFollower.value = null
  await answer(username, false)
}
</script>

<template>
  <div class="space-y-6">
    <UButton to="/feed" icon="i-lucide-arrow-left" label="Feed" color="neutral" variant="link" class="px-0" />
    <h1 class="text-2xl font-bold">
      Communauté
    </h1>

    <SocialGate>
      <section class="space-y-2">
        <h2 class="font-semibold">
          Votre pseudo
        </h2>
        <UsernameForm :initial="user?.username" />
      </section>

      <section class="space-y-2">
        <h2 class="font-semibold">
          Trouver des amis
        </h2>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Rechercher un pseudo"
          autocapitalize="none"
          :loading="searching"
          class="w-full"
        />
        <ul v-if="results.length" class="divide-y divide-default rounded-lg border border-default">
          <li v-for="person in results" :key="person.username" class="flex items-center gap-3 p-3">
            <NuxtLink :to="`/users/${person.username}`" class="min-w-0 flex-1 truncate font-medium hover:underline">
              @{{ person.username }}
            </NuxtLink>
            <FollowButton v-model:status="person.followStatus" :username="person.username" />
          </li>
        </ul>
        <p v-else-if="q.trim().length >= 2 && !searching" class="text-sm text-muted">
          Personne ne correspond à « {{ q.trim() }} ».
        </p>
      </section>

      <section v-if="requests?.length" class="space-y-2">
        <h2 class="font-semibold">
          Demandes d'abonnement
        </h2>
        <ul class="divide-y divide-default rounded-lg border border-default">
          <li v-for="request in requests" :key="request.username" class="flex items-center gap-2 p-3">
            <NuxtLink :to="`/users/${request.username}`" class="min-w-0 flex-1 truncate font-medium hover:underline">
              @{{ request.username }}
            </NuxtLink>
            <UButton label="Accepter" size="sm" :loading="busy === request.username" @click="answer(request.username, true)" />
            <UButton label="Refuser" size="sm" color="neutral" variant="ghost" :disabled="busy === request.username" @click="answer(request.username, false)" />
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="font-semibold">
          Abonnés · {{ followers?.length ?? 0 }}
        </h2>
        <p v-if="!followers?.length" class="text-sm text-muted">
          Personne ne vous suit encore.
        </p>
        <ul v-else class="divide-y divide-default rounded-lg border border-default">
          <li v-for="follower in followers" :key="follower.username" class="flex items-center gap-3 p-3">
            <NuxtLink :to="`/users/${follower.username}`" class="min-w-0 flex-1 truncate font-medium hover:underline">
              @{{ follower.username }}
            </NuxtLink>
            <UButton
              :label="armedFollower === follower.username ? 'Confirmer' : 'Retirer'"
              size="sm"
              :color="armedFollower === follower.username ? 'error' : 'neutral'"
              :variant="armedFollower === follower.username ? 'solid' : 'ghost'"
              :loading="busy === follower.username"
              @click="removeFollower(follower.username)"
            />
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="font-semibold">
          Abonnements · {{ following?.length ?? 0 }}
        </h2>
        <p v-if="!following?.length" class="text-sm text-muted">
          Vous ne suivez personne pour l'instant.
        </p>
        <ul v-else class="divide-y divide-default rounded-lg border border-default">
          <li v-for="person in following" :key="person.username" class="flex items-center gap-3 p-3">
            <NuxtLink :to="`/users/${person.username}`" class="min-w-0 flex-1 truncate font-medium hover:underline">
              @{{ person.username }}
            </NuxtLink>
            <FollowButton v-model:status="person.followStatus" :username="person.username" />
          </li>
        </ul>
      </section>
    </SocialGate>
  </div>
</template>
