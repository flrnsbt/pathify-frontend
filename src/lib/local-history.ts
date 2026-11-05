/**
 * Browser-local (IndexedDB) fallback history for generations that cannot be
 * stored in Firestore — primarily SVGs whose compressed payload exceeds the
 * ~1MiB field limit. Records keep the full uncompressed SVG so they remain
 * loadable in the history UI on this device; they never sync to the cloud.
 *
 * Three object stores:
 *  - `generations`: full generation records (incl. raw SVG), keyed `${imageHash}:${generationId}`
 *  - `genMeta`: lightweight per-generation index entries
 *  - `images`: per-source-image rollup used to render history entries without
 *    loading SVG payloads
 */

import type { HistoryGeneration } from "./firebase/firestore";

const DB_NAME = "vectorizerr-local-history";
const DB_VERSION = 1;
const MAX_LOCAL_GENERATIONS = 50;

interface LocalGenerationRecord extends HistoryGeneration {
  key: string;
  localOnly: true;
}

interface LocalGenMeta {
  key: string;
  imageHash: string;
  generationId: string;
  createdAt: number;
}

/** Per-image rollup mirroring the Firestore history entry shape. */
export interface LocalHistoryImage {
  imageHash: string;
  fileName: string;
  originalDimensions: { width: number; height: number };
  originalSize?: number;
  generationCount: number;
  earliestAt: number;
  latestAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("generations")) {
        db.createObjectStore("generations", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("genMeta")) {
        db.createObjectStore("genMeta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "imageHash" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function genKey(imageHash: string, generationId: string): string {
  return `${imageHash}:${generationId}`;
}

/** Recomputes the per-image rollup from genMeta after a delete. */
async function recomputeImageIndex(
  db: IDBDatabase,
  imageHash: string,
): Promise<void> {
  const tx = db.transaction(["genMeta", "images"], "readwrite");
  const metas = (await reqToPromise(tx.objectStore("genMeta").getAll())) as LocalGenMeta[];
  const mine = metas.filter((m) => m.imageHash === imageHash);
  const images = tx.objectStore("images");

  if (mine.length === 0) {
    images.delete(imageHash);
  } else {
    const existing = (await reqToPromise(images.get(imageHash))) as
      | LocalHistoryImage
      | undefined;
    const times = mine.map((m) => m.createdAt);
    images.put({
      imageHash,
      fileName: existing?.fileName || "traced-vector.svg",
      originalDimensions: existing?.originalDimensions || { width: 0, height: 0 },
      originalSize: existing?.originalSize,
      generationCount: mine.length,
      earliestAt: Math.min(...times),
      latestAt: Math.max(...times),
    });
  }
  await txDone(tx);
}

/** Evicts oldest generations when the local store exceeds the cap. */
async function evictOldestIfNeeded(db: IDBDatabase): Promise<void> {
  const metas = (await reqToPromise(
    db.transaction("genMeta", "readonly").objectStore("genMeta").getAll(),
  )) as LocalGenMeta[];
  const excess = metas.length - MAX_LOCAL_GENERATIONS;
  if (excess <= 0) return;

  const oldest = [...metas]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, excess);

  const affectedImages = new Set<string>();
  for (const meta of oldest) {
    const tx = db.transaction(["generations", "genMeta"], "readwrite");
    tx.objectStore("generations").delete(meta.key);
    tx.objectStore("genMeta").delete(meta.key);
    await txDone(tx);
    affectedImages.add(meta.imageHash);
  }
  for (const imageHash of affectedImages) {
    await recomputeImageIndex(db, imageHash);
  }
}

/** Saves a generation that could not be written to Firestore. Idempotent per key. */
export async function saveLocalGeneration(
  gen: HistoryGeneration,
): Promise<void> {
  if (typeof indexedDB === "undefined" || !gen.imageHash) return;
  const generationId = gen.generationId || gen.id;
  const key = genKey(gen.imageHash, generationId);
  const createdAt = gen.createdAt || Date.now();
  const db = await openDb();

  const tx = db.transaction(["generations", "genMeta", "images"], "readwrite");
  const generations = tx.objectStore("generations");
  const genMeta = tx.objectStore("genMeta");
  const images = tx.objectStore("images");

  generations.put({ ...gen, key, generationId, localOnly: true } as LocalGenerationRecord);
  genMeta.put({
    key,
    imageHash: gen.imageHash,
    generationId,
    createdAt,
  } satisfies LocalGenMeta);

  const existing = (await reqToPromise(images.get(gen.imageHash))) as
    | LocalHistoryImage
    | undefined;
  images.put({
    imageHash: gen.imageHash,
    fileName: gen.fileName || existing?.fileName || "traced-vector.svg",
    originalDimensions:
      gen.originalDimensions || existing?.originalDimensions || { width: 0, height: 0 },
    originalSize: gen.originalSize ?? existing?.originalSize,
    generationCount: (existing?.generationCount || 0) + 1,
    earliestAt: existing ? Math.min(existing.earliestAt, createdAt) : createdAt,
    latestAt: existing ? Math.max(existing.latestAt, createdAt) : createdAt,
  } satisfies LocalHistoryImage);

  await txDone(tx);
  db.close();
  const evictDb = await openDb();
  await evictOldestIfNeeded(evictDb);
  evictDb.close();
}

/** Lists per-image rollups (no SVG payloads), newest activity first. */
export async function fetchLocalImages(): Promise<LocalHistoryImage[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    const images = (await reqToPromise(
      db.transaction("images", "readonly").objectStore("images").getAll(),
    )) as LocalHistoryImage[];
    db.close();
    return images.sort((a, b) => b.latestAt - a.latestAt);
  } catch {
    return [];
  }
}

/** Fetches all local generations for one source image, newest first. */
export async function fetchLocalGenerations(
  imageHash: string,
): Promise<HistoryGeneration[]> {
  if (typeof indexedDB === "undefined" || !imageHash) return [];
  try {
    const db = await openDb();
    const metas = ((await reqToPromise(
      db.transaction("genMeta", "readonly").objectStore("genMeta").getAll(),
    )) as LocalGenMeta[]).filter((m) => m.imageHash === imageHash);

    const gens = await Promise.all(
      metas.map(async (meta) => {
        const rec = (await reqToPromise(
          db.transaction("generations", "readonly").objectStore("generations").get(meta.key),
        )) as LocalGenerationRecord | undefined;
        return rec;
      }),
    );
    db.close();
    return gens
      .filter((g): g is LocalGenerationRecord => Boolean(g))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Whether a generation already exists locally (dedupe / ownership checks). */
export async function localGenerationExists(
  imageHash: string,
  generationId: string,
): Promise<boolean> {
  if (typeof indexedDB === "undefined" || !imageHash || !generationId) {
    return false;
  }
  try {
    const db = await openDb();
    const rec = await reqToPromise(
      db.transaction("genMeta", "readonly").objectStore("genMeta").get(genKey(imageHash, generationId)),
    );
    db.close();
    return rec !== undefined;
  } catch {
    return false;
  }
}

/** Deletes one local generation and refreshes its image rollup. */
export async function deleteLocalGeneration(
  imageHash: string,
  generationId: string,
): Promise<void> {
  if (typeof indexedDB === "undefined" || !imageHash) return;
  const db = await openDb();
  const key = genKey(imageHash, generationId);
  const tx = db.transaction(["generations", "genMeta"], "readwrite");
  tx.objectStore("generations").delete(key);
  tx.objectStore("genMeta").delete(key);
  await txDone(tx);
  await recomputeImageIndex(db, imageHash);
  db.close();
}

/** Deletes every local generation for a source image plus its rollup. */
export async function deleteLocalGenerationsForImage(
  imageHash: string,
): Promise<void> {
  if (typeof indexedDB === "undefined" || !imageHash) return;
  const db = await openDb();
  const metas = ((await reqToPromise(
    db.transaction("genMeta", "readonly").objectStore("genMeta").getAll(),
  )) as LocalGenMeta[]).filter((m) => m.imageHash === imageHash);

  for (const meta of metas) {
    const tx = db.transaction(["generations", "genMeta"], "readwrite");
    tx.objectStore("generations").delete(meta.key);
    tx.objectStore("genMeta").delete(meta.key);
    await txDone(tx);
  }
  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").delete(imageHash);
  await txDone(tx);
  db.close();
}

/** Removes all locally stored fallback generations. */
export async function clearLocalGenerations(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction(["generations", "genMeta", "images"], "readwrite");
  tx.objectStore("generations").clear();
  tx.objectStore("genMeta").clear();
  tx.objectStore("images").clear();
  await txDone(tx);
  db.close();
}
