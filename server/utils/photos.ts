/**
 * Server helpers for workout photos.
 */

/**
 * Detects the format of an uploaded picture from its first bytes ("magic
 * numbers") rather than trusting the Content-Type header, which the client
 * controls: the stored mime type is later sent back to browsers as is.
 *
 * @param data - Raw bytes of the upload.
 * @returns The detected mime type, or null if it is neither JPEG nor WebP.
 */
export function sniffPhotoType(data: Buffer): PhotoMimeType | null {
  // JPEG: starts with FF D8 FF.
  if (data.length >= 3 && data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) return 'image/jpeg'
  // WebP: "RIFF" <4-byte size> "WEBP".
  if (data.length >= 12 && data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  return null
}

/**
 * Builds the URL of a workout photo, or null when it has none. The version
 * (last update time) makes every replacement a new URL, so the photo can be
 * cached forever by the browser.
 *
 * @param workoutId - The workout.
 * @param updatedAt - Last update of its photo, null when there is none.
 * @returns The URL, e.g. /api/workouts/12/photo?v=1730900000000.
 */
export function photoUrl(workoutId: number, updatedAt: Date | string | null) {
  return updatedAt === null ? null : `/api/workouts/${workoutId}/photo?v=${new Date(updatedAt).getTime()}`
}
