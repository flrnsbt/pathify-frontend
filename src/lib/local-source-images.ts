/**
 * Local (browser-only) store for original source images, keyed by imageHash.
 * History docs in Firestore no longer store the raw image — only the SVG and
 * parameters. The source image lives here so history items can be re-edited;
 * entries are capped and evicted oldest-first.
 */

const STORAGE_KEY = "vtracer_local_source_images";
const MAX_ENTRIES = 25;

interface SourceImageEntry {
  dataUrl: string;
  savedAt: number;
}

type SourceImageMap = Record<string, SourceImageEntry>;

function readMap(): SourceImageMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SourceImageMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: SourceImageMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded — drop oldest entries and retry once
    try {
      const keys = Object.keys(map).sort(
        (a, b) => (map[a].savedAt || 0) - (map[b].savedAt || 0),
      );
      for (const k of keys.slice(0, Math.ceil(keys.length / 2))) {
        delete map[k];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Give up silently — source images are best-effort
    }
  }
}

export function saveSourceImage(imageHash: string, dataUrl: string): void {
  if (!imageHash || !dataUrl) return;
  const map = readMap();
  map[imageHash] = { dataUrl, savedAt: Date.now() };

  // Evict oldest beyond cap
  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (map[a].savedAt || 0) - (map[b].savedAt || 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete map[k]);
  }
  writeMap(map);
}

export function getSourceImage(imageHash?: string): string | null {
  if (!imageHash) return null;
  return readMap()[imageHash]?.dataUrl || null;
}

/**
 * Removes all locally cached app data (source images, UI preferences).
 * Only touches keys under the app's own prefixes — auth/session untouched.
 */
export function clearLocalAppData(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("vtracer_") || k.startsWith("vectorizerr_") || k.startsWith("pathify_"))) {
        keys.push(k);
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
