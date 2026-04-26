/**
 * Zod schemas for the auth-route subset of `/api/users`.
 *
 * These schemas back the `validate()` middleware (see
 * `utilities/validate.js`) and are the single source of truth for input
 * format validation on the piloted auth routes:
 *
 *   POST /api/users                  -> signupSchema
 *   POST /api/users/login            -> loginSchema
 *   POST /api/users/forgot-password  -> forgotPasswordSchema
 *   POST /api/users/reset-password   -> resetPasswordSchema
 *
 * Confirm-email uses GET /api/users/confirm-email/:token and is therefore
 * not part of this pilot (it has no body to validate; param shape can be
 * folded in by a follow-up if we want to enforce the hex token format).
 *
 * Each schema is a `z.object({ body?, query?, params? })` so it composes
 * cleanly with the validate middleware contract.
 */

const { z } = require('zod');

// Reusable primitive schemas. Trim email so trailing whitespace from form
// posts doesn't trip the format check.
const emailSchema = z
  .string({ message: 'Email is required' })
  .trim()
  .min(3, { message: 'Invalid email format' })
  .max(254, { message: 'Invalid email format' })
  .pipe(z.email({ message: 'Invalid email format' }));

// Strong password (used for signup and reset). bd #8f36.2 raised the floor
// to 8 characters.
const strongPasswordSchema = z
  .string({ message: 'Password is required' })
  .min(8, { message: 'Password must be at least 8 characters long' })
  .max(256, { message: 'Password must be at most 256 characters long' });

// Login password — we deliberately do NOT enforce the 8-char minimum here
// because legacy accounts may still have shorter passwords. We only check
// that it is a non-empty string so the bcrypt compare has something to
// work with.
const loginPasswordSchema = z
  .string({ message: 'Password is required' })
  .min(1, { message: 'Password is required' });

const nameSchema = z
  .string({ message: 'Name is required' })
  .trim()
  .min(1, { message: 'Name is required' })
  .max(100, { message: 'Name must be at most 100 characters' });

const tokenSchema = z
  .string({ message: 'Token is required' })
  .min(1, { message: 'Token is required' });

const signupSchema = z.object({
  body: z.object({
    name: nameSchema,
    email: emailSchema,
    password: strongPasswordSchema,
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: loginPasswordSchema,
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: tokenSchema,
    password: strongPasswordSchema,
  }),
});

module.exports = {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
