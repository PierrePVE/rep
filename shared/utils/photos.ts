/**
 * Limits of workout photos, shared by the client (which shrinks the picture
 * before upload) and the API (which enforces them).
 */

/** Largest accepted upload, in bytes. Same cap as the database CHECK. */
export const MAX_PHOTO_BYTES = 1024 * 1024

/**
 * Longest side of the picture after the client shrinks it, in pixels: sharp
 * on a phone screen, and a JPEG at that size weighs a few hundred KB.
 */
export const PHOTO_MAX_DIMENSION = 1600

/** Accepted formats: what canvas.toBlob produces on every target browser. */
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/webp'] as const

export type PhotoMimeType = typeof PHOTO_MIME_TYPES[number]
