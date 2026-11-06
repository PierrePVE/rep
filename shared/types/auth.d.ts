/**
 * Typing of the nuxt-auth-utils session (cookie content).
 *
 * - `User` is readable by the client (useUserSession().user): only public data.
 * - `SecureSessionData` stays on the server: the GET /api/_auth/session route
 *   strips it, and the cookie itself is encrypted.
 *
 * Lives in shared/ so both the Vue app and the Nitro server see it.
 */
declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    // Same values as the `user_role` enum in server/db/schema.ts. Not imported
    // from there: shared/ code must not depend on server code.
    role: 'user' | 'admin' | 'demo'
    // Public name in the social feed, null until the user picks one.
    username: string | null
  }

  interface SecureSessionData {
    // Raw session token. Only its SHA-256 hash is stored in the `sessions` table.
    sessionToken: string
  }
}

export {}
