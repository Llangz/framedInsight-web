/**
 * lib/safe-redirect.ts
 *
 * Validates a candidate post-login redirect path (typically the `next`
 * query param the proxy layer attaches when it bounces an unauthenticated
 * user away from a protected route — see proxy.ts).
 *
 * Only ever returns an internal, single-segment-rooted path, never the
 * caller-supplied value verbatim — this is the one thing that has to be
 * airtight, since `next` is attacker-controlled input (anyone can craft
 * a login link with `?next=https://evil.example.com` or `?next=//evil.example.com`
 * and get a victim to log in for real, then be silently forwarded off-site
 * with a valid session cookie already set). Rejecting anything that isn't
 * a plain internal path closes that off.
 */
export function getSafeRedirectPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback

  // Must start with exactly one leading slash: rejects absolute URLs
  // (https://...), scheme-relative URLs (//evil.example.com), and
  // anything else that isn't a same-origin path.
  if (!next.startsWith('/') || next.startsWith('//')) return fallback

  // Reject backslashes too — some browsers normalise `/\evil.com` to
  // `//evil.com` before the request is even made.
  if (next.includes('\\')) return fallback

  // Only allow redirecting back into the areas middleware actually
  // protects. This also means a stray or stale `next` value pointing at
  // something unexpected just falls back safely rather than erroring.
  if (!/^\/(dashboard|onboarding)(\/|$|\?)/.test(next)) return fallback

  return next
}