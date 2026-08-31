/**
 * adminAuth.ts
 *
 * Client-side helpers for the admin-specific authentication flow.
 * Admin sessions are completely separate from Supabase user sessions —
 * they are stored only in sessionStorage and verified server-side via HMAC.
 */

const ADMIN_TOKEN_KEY = 'flatmate_admin_token';
const ADMIN_PROFILE_KEY = 'flatmate_admin_profile';

export interface AdminProfile {
  id: string;
  username: string;
  avatarColor: string;
  email: string;
}

/** Store admin token + profile after successful login */
export function setAdminSession(token: string, profile: AdminProfile): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  window.sessionStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(profile));
}

/** Get the stored admin token (null if not present) */
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

/** Get the cached admin profile (null if not present) */
export function getAdminProfile(): AdminProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(ADMIN_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminProfile;
  } catch {
    return null;
  }
}

/** Remove all admin session data (sign out) */
export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  window.sessionStorage.removeItem(ADMIN_PROFILE_KEY);
}

/** Quick check — does an admin token exist in sessionStorage? */
export function isAdminAuthenticated(): boolean {
  return getAdminToken() !== null;
}
