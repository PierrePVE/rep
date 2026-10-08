/**
 * Extracts a message to show the user from a failed $fetch call.
 *
 * API routes throw createError({ message }) with messages already written for
 * the user (in French), which $fetch exposes as `error.data.message`. Zod
 * validation errors are the exception: their message is a technical JSON dump,
 * so a generic text is shown instead (forms validate on the client first, so
 * this should rarely happen).
 *
 * @param error - Error caught from $fetch.
 * @param fallback - Text used when the error carries no usable message.
 * @returns The message to display.
 */
export function apiErrorMessage(error: unknown, fallback = 'Une erreur est survenue, réessayez.'): string {
  const data = (error as { data?: { message?: unknown, statusMessage?: unknown } } | null)?.data
  if (data?.statusMessage === 'ValidationError') return 'Données invalides'
  return typeof data?.message === 'string' && data.message ? data.message : fallback
}
