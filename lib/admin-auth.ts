/**
 * A single shared password for the admin screens.
 *
 * Deliberately not Supabase: the visitor accounts we add later are for
 * favouriting paintings, and the family should not need one of those to
 * curate. This keeps the two concerns apart.
 *
 * No `server-only` import — middleware needs this too.
 */

export const ADMIN_COOKIE = "basil_admin";

/**
 * The cookie value: a digest of the password, so the password itself is never
 * stored in the browser and the check stays stateless.
 */
export async function adminToken(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD is not set — /admin would be unprotected. See .env.example",
    );
  }

  const bytes = new TextEncoder().encode(`basil-swimmer-admin:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-safe, branch-free comparison so timing does not leak the token. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
