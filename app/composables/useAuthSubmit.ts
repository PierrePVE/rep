/** Auth routes that open a session when they succeed. */
type AuthEndpoint = '/api/auth/login' | '/api/auth/register' | '/api/auth/demo'

/**
 * Shared submit logic of the login / sign-up / demo actions: call the API,
 * refresh the client session, go to the home page, or show the error.
 *
 * @returns `loading` and `error` for the template, and `submit` to run a request.
 */
export function useAuthSubmit() {
  const { fetch: refreshSession } = useUserSession()
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * POSTs to an auth route (which sets the session cookie on success).
   * Takes the URL rather than a callback around $fetch: TypeScript cannot
   * infer Nitro's typed routes inside a generic callback ("excessive stack
   * depth").
   *
   * @param endpoint - Auth route to call.
   * @param body - Validated form data, if any.
   */
  async function submit(endpoint: AuthEndpoint, body?: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      await $fetch(endpoint, { method: 'POST', body })
      // The cookie is set, but useUserSession() still holds the old (logged
      // out) state: refresh it first, or the auth middleware would bounce the
      // navigation back to /login.
      await refreshSession()
      await navigateTo('/')
    }
    catch (e) {
      error.value = apiErrorMessage(e)
    }
    finally {
      loading.value = false
    }
  }

  return { loading, error, submit }
}
