/**
 * Global route guard (runs before every navigation, on the server for the
 * first page load, then in the browser).
 *
 * Only a UX convenience: it decides which page to show. The real protection
 * is server-side, in requireUser() / requireAdmin() on each API route.
 */

/** Pages reachable without being logged in. */
const PUBLIC_ROUTES = new Set(['/login', '/register'])

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  if (PUBLIC_ROUTES.has(to.path)) {
    // Already logged in: no reason to see the login form again.
    return loggedIn.value ? navigateTo('/') : undefined
  }
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
  if (to.path.startsWith('/admin') && user.value?.role !== 'admin') {
    return navigateTo('/')
  }
})
