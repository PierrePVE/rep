/**
 * Validation schemas of the auth forms, shared by the Vue forms (instant
 * feedback) and the API routes (the only check that can be trusted).
 * Files in shared/utils/ are auto-imported on both sides.
 */
import { z } from 'zod'

/**
 * Email, normalised (trimmed + lowercased) before being validated, so that
 * " Pierre@X.com" and "pierre@x.com" are the same account everywhere.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Adresse email invalide'))

// Capped because scrypt hashing cost grows with the input: an unbounded
// password would let anyone make the server burn CPU.
const PASSWORD_MAX = 128

/** Login form: any non-empty password, the server says if it matches. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(PASSWORD_MAX, `${PASSWORD_MAX} caractères maximum`),
})

/** Sign-up form: the password rules only apply when it is chosen. */
export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, '8 caractères minimum').max(PASSWORD_MAX, `${PASSWORD_MAX} caractères maximum`),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
