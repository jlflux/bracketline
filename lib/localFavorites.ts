// Followed teams for visitors without an account — kept in their browser.
const KEY = "bl_favorites";

function readAll(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getLocalFavorite(bracketId: string): string | null {
  return readAll()[bracketId] ?? null;
}

export function setLocalFavorite(bracketId: string, teamId: string | null) {
  try {
    const all = readAll();
    if (teamId) all[bracketId] = teamId;
    else delete all[bracketId];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private browsing or blocked storage — following just won't persist.
  }
}
