/**
 * Plugs the DB sessions into the two routes nuxt-auth-utils exposes to the
 * client, so the front end can keep using useUserSession() as documented:
 *
 * - GET /api/_auth/session (useUserSession().fetch): without this hook it
 *   would trust the cookie alone, and a revoked session would still look
 *   logged in on the client.
 * - DELETE /api/_auth/session (useUserSession().clear, i.e. logout): without
 *   this hook only the cookie would be removed and the DB session would stay.
 */
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    // The route returns this same object after the hook, so mutating it is how
    // we control what the client receives.
    const user = await resolveUser(event)
    if (user) {
      session.user = user
    }
    else {
      delete session.user
      delete session.secure
    }
  })

  sessionHooks.hook('clear', async (session) => {
    const token = session.secure?.sessionToken
    if (token) {
      await deleteSession(token)
    }
  })
})
