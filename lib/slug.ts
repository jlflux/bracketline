/**
 * Custom links: bracketline.app/blalock2026 instead of /b/8xe4aymg97.
 * Slugs live at the root of the site, so they can't collide with any of the
 * app's own paths.
 */

/** Top-level paths the app owns. A slug may not take one of these. */
const RESERVED = new Set([
  "b",
  "api",
  "new",
  "login",
  "logout",
  "signup",
  "dashboard",
  "forgot",
  "reset",
  "account",
  "settings",
  "admin",
  "about",
  "help",
  "support",
  "pricing",
  "terms",
  "privacy",
  "contact",
  "blog",
  "docs",
  "static",
  "public",
  "assets",
  "icon",
  "favicon",
  "robots",
  "sitemap",
  "_next",
  "well-known",
]);

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Tidy user input into a candidate slug: "Blalock 2026!" -> "blalock-2026". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export type SlugCheck = { ok: true } | { ok: false; error: string };

export function validateSlug(slug: string): SlugCheck {
  if (slug.length < SLUG_MIN)
    return {
      ok: false,
      error: `Links need at least ${SLUG_MIN} characters.`,
    };
  if (slug.length > SLUG_MAX)
    return {
      ok: false,
      error: `Links can be at most ${SLUG_MAX} characters.`,
    };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return {
      ok: false,
      error:
        "Use lowercase letters, numbers and hyphens only — no spaces or symbols.",
    };
  if (RESERVED.has(slug))
    return { ok: false, error: `"${slug}" is reserved by the site.` };
  return { ok: true };
}
