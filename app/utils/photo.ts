/**
 * Client-side shrinking of workout photos before upload.
 */

/**
 * Resizes a picture so its longest side is at most PHOTO_MAX_DIMENSION and
 * re-encodes it as JPEG, lowering the quality until it fits MAX_PHOTO_BYTES.
 * A phone photo goes from 3-5 MB to a few hundred KB: faster to send from
 * the gym, and the database stays small.
 *
 * Re-encoding also drops the EXIF metadata (GPS position of the gym, phone
 * model), which must not travel with a picture that followers will see.
 *
 * @param file - The picture picked or taken by the user.
 * @returns The JPEG to upload.
 * @throws If the browser cannot decode the file (not an image, or a format
 *   such as HEIC it does not support).
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  // 'from-image' applies the EXIF rotation, so portrait phone shots are not
  // stored sideways once the metadata is gone.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    // At this size 0.82 almost always fits on the first try; the loop only
    // matters for very detailed pictures.
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= MAX_PHOTO_BYTES) return blob
    }
    throw new Error('Photo trop lourde, même compressée')
  }
  finally {
    // Frees the decoded pixels right away (tens of MB for a phone photo).
    bitmap.close()
  }
}
