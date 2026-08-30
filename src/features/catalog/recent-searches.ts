export const RECENT_SEARCHES_STORAGE_KEY = "party-heaven:storefront:recent-searches";
export const RECENT_SEARCHES_MAX_ITEMS = 8;

function normalizeRecentSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function toRecentSearchKey(query: string): string {
  return normalizeRecentSearchQuery(query).toLocaleLowerCase();
}

function sanitizeRecentSearchList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const normalized = normalizeRecentSearchQuery(item);
    if (normalized.length === 0) {
      continue;
    }

    const key = toRecentSearchKey(normalized);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sanitized.push(normalized);
  }

  return sanitized.slice(0, RECENT_SEARCHES_MAX_ITEMS);
}

export function addRecentSearch(
  current: string[],
  query: string,
  maxItems = RECENT_SEARCHES_MAX_ITEMS,
): string[] {
  const normalized = normalizeRecentSearchQuery(query);
  if (normalized.length === 0 || maxItems <= 0) {
    return current;
  }

  const next = [normalized, ...current.filter((item) => toRecentSearchKey(item) !== toRecentSearchKey(normalized))];
  return next.slice(0, maxItems);
}

export function removeRecentSearch(current: string[], query: string): string[] {
  const keyToRemove = toRecentSearchKey(query);
  return current.filter((item) => toRecentSearchKey(item) !== keyToRemove);
}

export function readRecentSearches(storage: Storage = window.localStorage): string[] {
  const raw = storage.getItem(RECENT_SEARCHES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeRecentSearchList(parsed);
  } catch {
    return [];
  }
}

export function writeRecentSearches(items: string[], storage: Storage = window.localStorage): void {
  const sanitized = sanitizeRecentSearchList(items);
  storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(sanitized));
}

export function clearRecentSearches(storage: Storage = window.localStorage): void {
  storage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
}
