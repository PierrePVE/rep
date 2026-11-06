/**
 * Display helpers for the workout screens (logging, history), in French.
 * Auto-imported by Nuxt in every component, like apiErrorMessage.
 */

/**
 * Formats the load of a set: "PDC" (poids du corps) for 0 kg, which is how
 * bodyweight sets are logged, else the weight with a French decimal comma.
 *
 * @param weightKg - Weight of the set.
 * @returns The text to show, e.g. "82,5 kg".
 */
export function formatWeight(weightKg: number) {
  return weightKg === 0 ? 'PDC' : `${weightKg.toLocaleString('fr-FR')} kg`
}

/**
 * Formats a session volume, rounded to the kilogram (decimals mean nothing at
 * that scale), with French thousands separators.
 *
 * @param volumeKg - Total weight × reps.
 * @returns The text to show, e.g. "12 450 kg".
 */
export function formatVolume(volumeKg: number) {
  return `${Math.round(volumeKg).toLocaleString('fr-FR')} kg`
}

/**
 * Formats the length of a session: "45 min", or "1 h 05" past an hour.
 *
 * @param startedAt - Start, as an ISO string from the API.
 * @param endedAt - End, as an ISO string from the API.
 * @returns The text to show.
 */
export function formatDuration(startedAt: string, endedAt: string) {
  const minutes = Math.max(Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000), 0)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/**
 * Formats the day of a session, e.g. "lun. 3 nov.".
 *
 * @param date - ISO string from the API.
 * @returns The text to show.
 */
export function formatDay(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
