/** Client-side checks aligned with backend `app.services.password_policy`. */

const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/

export function validatePasswordClient(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter'
  if (!/\d/.test(password)) return 'Password must contain at least one number'
  if (!SPECIAL.test(password)) return 'Password must contain at least one special character'
  return null
}
