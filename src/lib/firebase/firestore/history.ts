import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getDoc,
  getCountFromServer,
  writeBatch,
} from "firebase/firestore";
import type { DocumentSnapshot, QueryConstraint, QueryDocumentSnapshot } from "firebase/firestore";
import { db, auth, getAppCheckToken } from "../config";
import { handleAuthExpired } from "../auth-context";
import { compressSvgString, decompressSvgString, decompressSvgBytes } from "../../vtracer/compression";
import { APP_CONFIG } from "@/config/app.config";
import { buildApiHeaders } from "../../api-headers";
import { HistoryEntry, HistoryGeneration, HistoryPage, HISTORY_PAGE_SIZE, SaveHistoryResult } from "./types";
import { handleUnauthorizedResponse, readApiJson } from "./utils";

// Keep in sync with MAX_SVG_STORAGE_BYTES in backend/src/services/firestore.ts.
// The 'gz:' payload is base64, so raw gzip bytes ≈ length * 3/4.
const MAX_REMOTE_SVG_GZIP_BYTES = 1_000_000;

function mapHistoryEntry(docSnap: QueryDocumentSnapshot, userId: string): HistoryEntry {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId,
    imageHash: data.imageHash || docSnap.id,
    fileName: data.fileName || "traced-vector.svg",
    originalDimensions: data.originalDimensions || { width: 0, height: 0 },
    originalSize: data.originalSize || 0,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || data.createdAt || Date.now(),
  };
}

async function mapHistoryGeneration(
  docSnap: QueryDocumentSnapshot,
  userId: string,
): Promise<HistoryGeneration> {
  const data = docSnap.data();
  // svg is stored as Firestore bytesValue (raw gzip). The client SDK surfaces
  // it as a `Bytes` object (not a Uint8Array) — unwrap via toUint8Array().
  // Tolerate Uint8Array/ArrayBuffer and the legacy 'gz:' string format too.
  const rawSvg = data.svg as unknown;
  let svgBytes: Uint8Array | null = null;
  if (rawSvg instanceof Uint8Array) {
    svgBytes = rawSvg;
  } else if (rawSvg instanceof ArrayBuffer) {
    svgBytes = new Uint8Array(rawSvg);
  } else if (rawSvg && typeof (rawSvg as { toUint8Array?: unknown }).toUint8Array === 'function') {
    svgBytes = (rawSvg as { toUint8Array: () => Uint8Array }).toUint8Array();
  }
  const decompressedSvg =
    typeof rawSvg === "string"
      ? await decompressSvgString(rawSvg)
      : svgBytes
        ? await decompressSvgBytes(svgBytes)
        : "";
  return {
    id: docSnap.id,
    generationId: data.generationId || docSnap.id,
    userId,
    imageHash: data.imageHash,
    fileName: data.fileName || "traced-vector.svg",
    originalDimensions: data.originalDimensions || { width: 0, height: 0 },
    originalSize: data.originalSize || 0,
    nodeCount: data.nodeCount || 0,
    executionTimeMs: data.executionTimeMs || 0,
    parameters: data.parameters || {},
    svg: decompressedSvg,
    svgSize: data.svgSize || decompressedSvg.length,
    createdAt: data.createdAt || Date.now(),
  };
}

/**
 * Saves a vectorization history item via the backend server endpoint (service account auth).
 * Compresses the SVG data using gzip before storing.
 * Client-side Firestore direct writes are removed for security.
 * Only paid generations should be passed to this function.
 *
 * Returns cloudSaved=false (with tooLarge set when applicable) when the
 * backend rejects the write — callers should fall back to local storage.
 */
export async function saveVectorizationHistory(
  userId: string,
  data: Omit<HistoryGeneration, "id" | "userId" | "createdAt">,
): Promise<SaveHistoryResult> {
  // Gzip-compress SVG for compact storage
  const compressedSvg = await compressSvgString(data.svg);

  const savedId = `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Oversized payloads can never fit the Firestore field limit — skip the
  // upload entirely and let the caller store the generation locally.
  const estGzipBytes = Math.floor(((compressedSvg?.length ?? 0) - 3) * 0.75);
  if (compressedSvg?.startsWith("gz:") && estGzipBytes > MAX_REMOTE_SVG_GZIP_BYTES) {
    return { savedId, cloudSaved: false, tooLarge: true };
  }

  // Exclude userId from the API body — the backend extracts it from the Firebase ID token
  const itemToStore = {
    ...data,
    svg: compressedSvg,
    createdAt: Date.now(),
  };

  let result: SaveHistoryResult = { savedId, cloudSaved: false, tooLarge: false };

  const endpoint = APP_CONFIG.api.saveHistoryUrl || "/api/save-history";
  try {
    let idToken: string | undefined;
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        idToken = await currentUser.getIdToken();
      } catch (tokenErr) {
        console.warn("[History] Token retrieval failed:", tokenErr);
        await handleAuthExpired();
      }
    }

    const appCheckToken = await getAppCheckToken();
    const headers = buildApiHeaders({ appCheckToken, idToken });

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(itemToStore),
    });

    if (res.status === 401) {
      await handleUnauthorizedResponse(res);
    }

    if (res.ok) {
      const resJson = await readApiJson(res);
      result = {
        savedId:
          typeof resJson.generationId === "string"
            ? resJson.generationId
            : savedId,
        cloudSaved: true,
        tooLarge: false,
      };
    } else {
      result.tooLarge = res.status === 413;
      console.warn(
        "Backend history saving returned error status:",
        res.status,
        result.tooLarge ? "(SVG too large for Firestore)" : "",
      );
    }
  } catch (err) {
    console.warn("Failed to write history to backend:", err);
  }

  return result;
}

/**
 * Fetches one page of history entries (one per source image), newest activity
 * first. Pass `page.lastCursor` back as `cursor` for the next page.
 */
export async function fetchHistoryEntries(
  userId: string,
  cursor?: DocumentSnapshot | null,
  pageSize: number = HISTORY_PAGE_SIZE,
): Promise<HistoryPage<HistoryEntry>> {
  const historyCollection = collection(db, "users", userId, "history");
  const constraints: QueryConstraint[] = [
    orderBy("updatedAt", "desc"),
    orderBy("createdAt", "desc"),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize + 1));
  const q = query(historyCollection, ...constraints);
  const snapshot = await getDocs(q);

  const hasMore = snapshot.docs.length > pageSize;
  const pageDocs = snapshot.docs.slice(0, pageSize);
  return {
    items: pageDocs.map((d) => mapHistoryEntry(d, userId)),
    lastCursor: hasMore ? (pageDocs[pageDocs.length - 1] ?? null) : null,
    hasMore,
  };
}

/** Total number of history entries (source images) for the badge counter. */
export async function fetchHistoryCount(userId: string): Promise<number> {
  const historyCollection = collection(db, "users", userId, "history");
  const snap = await getCountFromServer(query(historyCollection));
  return snap.data().count;
}

/**
 * Fetches all generations for a history entry (its source image), newest first.
 * SVGs are gzip-compressed in Firestore and decompressed here.
 */
export async function fetchHistoryGenerations(
  userId: string,
  entryId: string,
  pageSize: number = 100,
): Promise<HistoryGeneration[]> {
  const gensCollection = collection(
    db,
    "users",
    userId,
    "history",
    entryId,
    "generations",
  );
  const q = query(gensCollection, orderBy("createdAt", "desc"), limit(pageSize));
  const snapshot = await getDocs(q);
  return Promise.all(
    snapshot.docs.map((d) => mapHistoryGeneration(d, userId)),
  );
}

/**
 * Checks whether a generation (by SVG content hash) already exists under the
 * history entry for the given source image — used for paid-generation dedupe.
 */
export async function historyGenerationExists(
  userId: string,
  imageHash: string,
  generationId: string,
): Promise<boolean> {
  const genRef = doc(
    db,
    "users",
    userId,
    "history",
    imageHash,
    "generations",
    generationId,
  );
  const snap = await getDoc(genRef);
  return snap.exists();
}

/**
 * Checks the account-scoped validated-generation marker
 * (users/{uid}/validatedGenerations/{svgHash}). Written server-side when
 * quota is consumed, so it survives history deletion and is independent of
 * which source image produced the SVG.
 */
export async function validatedGenerationExists(
  userId: string,
  generationId: string,
): Promise<boolean> {
  if (!userId || !generationId) return false;
  const ref = doc(db, "users", userId, "validatedGenerations", generationId);
  const snap = await getDoc(ref);
  return snap.exists();
}

/** Deletes a single generation from a history entry. */
export async function deleteHistoryGeneration(
  userId: string,
  entryId: string,
  generationId: string,
): Promise<void> {
  const genRef = doc(
    db,
    "users",
    userId,
    "history",
    entryId,
    "generations",
    generationId,
  );
  await deleteDoc(genRef);
}

/** Deletes a history entry and every generation under it. */
export async function deleteHistoryEntry(
  userId: string,
  entryId: string,
): Promise<void> {
  const gensCollection = collection(
    db,
    "users",
    userId,
    "history",
    entryId,
    "generations",
  );

  // Page through generations (Firestore batches cap at 500 writes)
  let lastDoc: DocumentSnapshot | undefined;
  for (;;) {
    let q = query(gensCollection, orderBy("createdAt", "desc"), limit(400));
    if (lastDoc) q = query(gensCollection, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(400));
    const snap = await getDocs(q);
    if (snap.empty) break;
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 400) break;
  }

  await deleteDoc(doc(db, "users", userId, "history", entryId));
}

/** Deletes every history entry (and its generations) for the user. */
export async function deleteAllHistoryEntries(userId: string): Promise<void> {
  const historyCollection = collection(db, "users", userId, "history");
  let lastDoc: DocumentSnapshot | undefined;
  for (;;) {
    let q = query(historyCollection, orderBy("updatedAt", "desc"), limit(50));
    if (lastDoc) q = query(historyCollection, orderBy("updatedAt", "desc"), startAfter(lastDoc), limit(50));
    const snap = await getDocs(q);
    if (snap.empty) break;
    for (const d of snap.docs) {
      await deleteHistoryEntry(userId, d.id);
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 50) break;
  }
}
