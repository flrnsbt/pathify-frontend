import { firebaseConfig } from "@/lib/firebase/config";
import { APP_CONFIG } from "@/config/app.config";
import { NextRequest, NextResponse } from "next/server";

const HANDSHAKE_SECRET = process.env.HANDSHAKE_SECRET as string;

const FIREBASE_API_KEY = firebaseConfig.apiKey;

const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

const FIREBASE_PROJECT_NUMBER = "717678476656";

// CORS allowed origins from central app config
const ALLOWED_ORIGINS = APP_CONFIG.allowedOrigins;

// JWKS cache
let cachedJwks: {
  keys: Array<{ n: string; e: string; kid: string }>;
  exp: number;
} | null = null;

/**
 * Verifies CORS origin and returns CORS headers
 */
function getCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = (ALLOWED_ORIGINS as readonly string[]).includes(origin)
    ? origin
    : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Firebase-AppCheck",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Fetches Firebase App Check JWKS public keys with caching
 */
async function getAppCheckJwks(): Promise<
  Array<{ n: string; e: string; kid: string }>
> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.exp > now) {
    return cachedJwks.keys;
  }

  try {
    const res = await fetch(`https://firebaseappcheck.googleapis.com/v1/jwks`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const data = (await res.json()) as {
      keys: Array<{ n: string; e: string; kid: string }>;
    };
    cachedJwks = { keys: data.keys, exp: now + 3600000 };
    return data.keys;
  } catch (err) {
    console.error("[Handshake API] Error fetching JWKS:", err);
    throw err;
  }
}

/**
 * Decodes base64url string to ArrayBuffer
 */
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts DER-encoded RSA public key to SPKI format for Web Crypto
 */
function derToSpki(nB64: string, eB64: string): Promise<CryptoKey> {
  const nBuf = base64UrlToBuffer(nB64);
  const eBuf = base64UrlToBuffer(eB64);
  const n = new Uint8Array(nBuf);
  const e = new Uint8Array(eBuf);

  // Build ASN.1 DER structure for RS256 (2048-bit key)
  const nLen = n.length;
  const eLen = e.length;

  // DER encode the modulus
  const nDerLen = nLen + 2;
  const nDer = new Uint8Array(nDerLen);
  nDer[0] = 0x02; // INTEGER tag
  nDer[1] = nLen;
  nDer.set(n, 2);

  // DER encode the exponent
  const eDerLen = eLen + 2;
  const eDer = new Uint8Array(eDerLen);
  eDer[0] = 0x02;
  eDer[1] = eLen;
  eDer.set(e, 2);

  // Sequence for the two integers
  const intSeqLen = nDerLen + eDerLen + 2;
  const intSeq = new Uint8Array(intSeqLen);
  intSeq[0] = 0x30;
  intSeq[1] = nDerLen + eDerLen;
  intSeq.set(nDer, 2);
  intSeq.set(eDer, 2 + nDerLen);

  // Algorithm identifier: RSA with SHA-256 (1.2.840.113549.1.1.11)
  const algId = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x0b, 0x05, 0x00,
  ]);

  // Outer sequence
  const totalLen = intSeqLen + algId.length + 2;
  const spki = new Uint8Array(totalLen);
  spki[0] = 0x30;
  spki[1] = totalLen - 2;
  spki.set(algId, 2);
  // BIT STRING wrapper
  spki[2 + algId.length] = 0x03;
  spki[2 + algId.length + 1] = intSeqLen + 1;
  spki[2 + algId.length + 2] = 0x00; // no unused bits
  spki.set(intSeq, 2 + algId.length + 3);

  // Base64url encode
  const spkiB64 = btoa(String.fromCharCode(...spki))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const fullJwk = `{"kty":"RSA","n":"${nB64}","e":"${eB64}","alg":"RS256","use":"sig"}`;
  return crypto.subtle.importKey(
    "jwk",
    JSON.parse(fullJwk),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/**
 * Verifies a Firebase App Check token using JWKS
 */
async function verifyAppCheckToken(
  token: string,
): Promise<{ appId: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Decode header
    const header = JSON.parse(
      new TextDecoder().decode(base64UrlToBuffer(parts[0])),
    ) as { alg: string; typ: string; kid: string };

    if (header.alg !== "RS256") return null;
    if (header.typ !== "JWT") return null;

    // Decode payload
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBuffer(parts[1])),
    ) as {
      iss: string;
      aud: string;
      exp: number;
      sub: string;
    };

    // Verify issuer
    const expectedIss = `https://firebaseappcheck.googleapis.com/${FIREBASE_PROJECT_NUMBER}`;
    if (payload.iss !== expectedIss) return null;

    // Verify audience
    const expectedAud = `projects/${FIREBASE_PROJECT_NUMBER}`;
    if (!payload.aud.includes(expectedAud)) return null;

    // Verify expiration
    if (payload.exp <= Date.now() / 1000) return null;

    // Verify signature
    const jwks = await getAppCheckJwks();
    const key = jwks.find((k) => k.kid === header.kid);
    if (!key) return null;

    const cryptoKey = await derToSpki(key.n, key.e);
    const signatureBuf = base64UrlToBuffer(parts[2]);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signatureBuf,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );

    if (!valid) return null;

    return { appId: payload.sub };
  } catch (err) {
    console.warn("[Handshake API] App Check token verification failed:", err);
    return null;
  }
}

/**
 * Computes an HMAC-SHA256 hex signature using Web Crypto API
 */
async function computeHmacSha256(
  secret: string,
  message: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const arr = Array.from(new Uint8Array(signature));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Cache for Google Auth JWKS
let cachedGoogleAuthJwks: {
  keys: Array<{ kty: string; alg: string; use: string; n: string; e: string; kid: string }>;
  exp: number;
} | null = null;

async function getGoogleAuthJwks(): Promise<
  Array<{ kty: string; alg: string; use: string; n: string; e: string; kid: string }>
> {
  const now = Date.now();
  if (cachedGoogleAuthJwks && cachedGoogleAuthJwks.exp > now) {
    return cachedGoogleAuthJwks.keys;
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) throw new Error(`Google Auth JWKS fetch failed: ${res.status}`);
    const data = (await res.json()) as {
      keys: Array<{ kty: string; alg: string; use: string; n: string; e: string; kid: string }>;
    };
    cachedGoogleAuthJwks = { keys: data.keys, exp: now + 3600000 };
    return data.keys;
  } catch (err) {
    console.warn('[Handshake API] Error fetching Google Auth JWKS:', err);
    return [];
  }
}

/**
 * Verifies Firebase Auth ID Token using Web Crypto RS256 JWKS verification
 * with fallback to Google Identity Toolkit REST API
 */
async function verifyFirebaseIdToken(
  idToken: string,
): Promise<{ uid: string; email?: string } | null> {
  if (!idToken || typeof idToken !== 'string') return null;

  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  // 1. Attempt Cryptographic Web Crypto RS256 Verification against Google JWKS
  try {
    const headerStr = new TextDecoder().decode(base64UrlToBuffer(parts[0]));
    const payloadStr = new TextDecoder().decode(base64UrlToBuffer(parts[1]));
    const header = JSON.parse(headerStr);
    const payload = JSON.parse(payloadStr);

    if (header.alg === 'RS256' && header.kid) {
      let keys = await getGoogleAuthJwks();
      let key = keys.find((k) => k.kid === header.kid);

      if (!key) {
        cachedGoogleAuthJwks = null;
        keys = await getGoogleAuthJwks();
        key = keys.find((k) => k.kid === header.kid);
      }

      if (key) {
        const cryptoKey = await crypto.subtle.importKey(
          'jwk',
          key,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify']
        );

        const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        const signatureBuf = base64UrlToBuffer(parts[2]);

        const isValid = await crypto.subtle.verify(
          'RSASSA-PKCS1-v1_5',
          cryptoKey,
          signatureBuf,
          signedData
        );

        if (isValid) {
          const now = Math.floor(Date.now() / 1000);
          const expectedAud = FIREBASE_PROJECT_ID || 'vectorizerr';

          if (payload.exp && payload.exp < now) {
            console.warn(`[Handshake API] Token expired (exp: ${payload.exp}, now: ${now})`);
            return null;
          }
          if (payload.aud !== expectedAud) {
            console.warn(`[Handshake API] Audience mismatch: expected ${expectedAud}, got ${payload.aud}`);
            return null;
          }
          if (payload.iss !== `https://securetoken.google.com/${expectedAud}`) {
            console.warn(`[Handshake API] Issuer mismatch: ${payload.iss}`);
            return null;
          }

          const uid = payload.user_id || payload.sub;
          if (uid) {
            return { uid, email: payload.email };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Handshake API] JWKS check error, trying REST fallback:', err);
  }

  // 2. Fallback to Identity Toolkit REST API
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://vectorizerr.pages.dev",
      },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      console.warn("[Handshake API] Token verification failed:", res.status);
      return null;
    }

    const data = (await res.json()) as {
      users?: Array<{ localId: string; email?: string }>;
    };
    if (!data.users || data.users.length === 0) {
      return null;
    }

    return {
      uid: data.users[0].localId,
      email: data.users[0].email,
    };
  } catch (err) {
    console.error("[Handshake API] Error verifying Firebase token:", err);
    return null;
  }
}

interface FirestoreRestDoc {
  fields?: {
    credits?: { integerValue?: string };
    isAdmin?: { booleanValue?: boolean };
    subscription?: {
      mapValue?: { fields?: { status?: { stringValue?: string } } };
    };
    unlockedImages?: {
      mapValue?: {
        fields?: Record<
          string,
          {
            mapValue?: {
              fields?: {
                imageHash?: { stringValue?: string };
                generationsUsed?: { integerValue?: string };
                maxGenerations?: { integerValue?: string };
                unlockedAt?: { integerValue?: string };
              };
            };
          }
        >;
      };
    };
  };
}

interface FirestoreUserRecord {
  uid: string;
  credits: number;
  isAdmin: boolean;
  subscription: { status: string };
  unlockedImages: Record<
    string,
    {
      mapValue?: {
        fields?: {
          imageHash?: { stringValue?: string };
          generationsUsed?: { integerValue?: string };
          maxGenerations?: { integerValue?: string };
          unlockedAt?: { integerValue?: string };
        };
      };
    }
  >;
}

/**
 * Retrieves a user document from Firestore using REST API with auth token
 */
async function getFirestoreUser(
  userId: string,
  idToken: string,
): Promise<FirestoreUserRecord | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      console.warn(
        `[Handshake API] Firestore read failed: ${res.status} for user ${userId}`,
      );
      return null;
    }
    const doc = (await res.json()) as FirestoreRestDoc;
    const fields = doc.fields || {};

    return {
      uid: userId,
      credits: fields.credits?.integerValue
        ? Number(fields.credits.integerValue)
        : 0,
      isAdmin: Boolean(fields.isAdmin?.booleanValue),
      subscription: fields.subscription?.mapValue?.fields
        ? {
            status:
              fields.subscription.mapValue.fields.status?.stringValue ||
              "inactive",
          }
        : { status: "inactive" },
      unlockedImages: fields.unlockedImages?.mapValue?.fields || {},
    };
  } catch (err) {
    console.error("[Handshake API] Error getting user document:", err);
    return null;
  }
}

/**
 * Atomically updates user in Firestore with auth token
 */
async function updateFirestoreUser(
  userId: string,
  newCredits: number,
  unlockedImagesObj: Record<string, unknown>,
  idToken: string,
): Promise<boolean> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?updateMask.fieldPaths=credits&updateMask.fieldPaths=unlockedImages&updateMask.fieldPaths=updatedAt`;

  // Build fields
  const fields = {
    credits: { integerValue: String(newCredits) },
    unlockedImages: {
      mapValue: {
        fields: unlockedImagesObj,
      },
    },
    updatedAt: { timestampValue: new Date().toISOString() },
  };

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      console.warn(
        `[Handshake API] Firestore update failed: ${res.status} for user ${userId}`,
      );
    }
    return res.ok;
  } catch (err) {
    console.error("[Handshake API] Error updating user:", err);
    return false;
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const appCheckToken = req.headers.get("X-Firebase-AppCheck");
    const authHeader = req.headers.get("Authorization") || "";

    // If Cloudflare Worker backend is configured, forward securely with server-side API_SECRET
    const backendUrl = process.env.BACKEND_URL || APP_CONFIG.api.backendUrl;
    if (backendUrl && !backendUrl.includes('localhost:3000')) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.API_SECRET) {
        headers['x-api-secret'] = process.env.API_SECRET;
      }
      if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
      }
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const bodyText = await req.text();
      const workerRes = await fetch(`${backendUrl}/api/handshake`, {
        method: 'POST',
        headers,
        body: bodyText,
      });

      const data = await workerRes.json().catch(() => ({}));
      return NextResponse.json(data, { status: workerRes.status, headers: corsHeaders });
    }

    // 1. App Check token verification
    if (!appCheckToken) {
      return NextResponse.json(
        { success: false, error: "App Check token required." },
        { status: 401, headers: corsHeaders },
      );
    }

    const appCheckResult = await verifyAppCheckToken(appCheckToken);
    if (!appCheckResult) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired App Check token." },
        { status: 401, headers: corsHeaders },
      );
    }

    // 2. Auth Token verification
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Missing or invalid Authorization header.",
        },
        { status: 401, headers: corsHeaders },
      );
    }

    const idToken = authHeader.replace("Bearer ", "").trim();
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (!verifiedUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid Firebase authentication token.",
        },
        { status: 401, headers: corsHeaders },
      );
    }

    const userId = verifiedUser.uid;

    // 3. Parse Handshake Request
    const body = await req.json().catch(() => ({}));
    const { action, imageHash } = body as {
      action: "unlock_image" | "consume_generation" | "verify_ticket";
      imageHash: string;
      ticketId?: string;
    };

    if (!imageHash || typeof imageHash !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing valid imageHash in handshake request.",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    // 4. Fetch Authentic Server Profile from Firestore
    const userProfile = await getFirestoreUser(userId, idToken);
    const credits = userProfile?.credits ?? 0;
    const isAdmin = Boolean(userProfile?.isAdmin);
    const isSubscribed = userProfile?.subscription?.status === "active";
    const unlockedImages = userProfile?.unlockedImages || {};

    const existingUnlock = unlockedImages[imageHash]?.mapValue?.fields;
    const generationsUsed = existingUnlock?.generationsUsed?.integerValue
      ? Number(existingUnlock.generationsUsed.integerValue)
      : 0;
    const maxGenerations = existingUnlock?.maxGenerations?.integerValue
      ? Number(existingUnlock.maxGenerations.integerValue)
      : 10;
    const remainingGens = Math.max(0, maxGenerations - generationsUsed);

    const now = Date.now();
    const expiresAt = now + 86400000 * 30; // 30 days
    const nonce =
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const ticketId = `ticket_${now}_${nonce.slice(0, 8)}`;

    // 5. Handle Action
    if (action === "unlock_image") {
      // If already unlocked with remaining generations or admin/subscriber
      if (isAdmin || isSubscribed || (existingUnlock && remainingGens > 0)) {
        const quota = isAdmin || isSubscribed ? 9999 : remainingGens;
        const msgToSign = `${ticketId}:${userId}:${imageHash}:${quota}:${expiresAt}:${nonce}`;
        const signature = await computeHmacSha256(HANDSHAKE_SECRET, msgToSign);

        return NextResponse.json(
          {
            success: true,
            ticket: {
              ticketId,
              userId,
              imageHash,
              generationsRemaining: quota,
              generationsUsed,
              maxGenerations: quota,
              expiresAt,
              issuedAt: now,
              nonce,
              signature,
            },
            generationsRemaining: quota,
            creditsRemaining: credits,
          },
          { headers: corsHeaders },
        );
      }

      // Check if user has at least 1 credit
      if (credits < 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Insufficient credits to unlock image. Please purchase a credit pack.",
            creditsRemaining: credits,
          },
          { status: 402, headers: corsHeaders },
        );
      }

      // Deduct 1 credit & unlock image for 10 generations
      const newCredits = credits - 1;
      const updatedUnlocked = {
        ...unlockedImages,
        [imageHash]: {
          mapValue: {
            fields: {
              imageHash: { stringValue: imageHash },
              generationsUsed: { integerValue: "0" },
              maxGenerations: { integerValue: "10" },
              unlockedAt: { integerValue: String(now) },
            },
          },
        },
      };

      await updateFirestoreUser(userId, newCredits, updatedUnlocked, idToken);

      const msgToSign = `${ticketId}:${userId}:${imageHash}:10:${expiresAt}:${nonce}`;
      const signature = await computeHmacSha256(HANDSHAKE_SECRET, msgToSign);

      return NextResponse.json(
        {
          success: true,
          ticket: {
            ticketId,
            userId,
            imageHash,
            generationsRemaining: 10,
            generationsUsed: 0,
            maxGenerations: 10,
            expiresAt,
            issuedAt: now,
            nonce,
            signature,
          },
          generationsRemaining: 10,
          creditsRemaining: newCredits,
        },
        { headers: corsHeaders },
      );
    } else if (action === "consume_generation") {
      if (isAdmin || isSubscribed) {
        const msgToSign = `${ticketId}:${userId}:${imageHash}:9999:${expiresAt}:${nonce}`;
        const signature = await computeHmacSha256(HANDSHAKE_SECRET, msgToSign);
        return NextResponse.json(
          {
            success: true,
            ticket: {
              ticketId,
              userId,
              imageHash,
              generationsRemaining: 9999,
              generationsUsed: 0,
              maxGenerations: 9999,
              expiresAt,
              issuedAt: now,
              nonce,
              signature,
            },
            generationsRemaining: 9999,
            creditsRemaining: credits,
          },
          { headers: corsHeaders },
        );
      }

      if (!existingUnlock || remainingGens <= 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No generations remaining for this image. Please unlock with 1 credit.",
            generationsRemaining: 0,
          },
          { status: 403, headers: corsHeaders },
        );
      }

      const newGenerationsUsed = generationsUsed + 1;
      const updatedRemaining = Math.max(0, maxGenerations - newGenerationsUsed);

      const updatedUnlocked = {
        ...unlockedImages,
        [imageHash]: {
          mapValue: {
            fields: {
              imageHash: { stringValue: imageHash },
              generationsUsed: { integerValue: String(newGenerationsUsed) },
              maxGenerations: { integerValue: String(maxGenerations) },
              unlockedAt: {
                integerValue:
                  existingUnlock?.unlockedAt?.integerValue || String(now),
              },
            },
          },
        },
      };

      await updateFirestoreUser(userId, credits, updatedUnlocked, idToken);

      const msgToSign = `${ticketId}:${userId}:${imageHash}:${updatedRemaining}:${expiresAt}:${nonce}`;
      const signature = await computeHmacSha256(HANDSHAKE_SECRET, msgToSign);

      return NextResponse.json(
        {
          success: true,
          ticket: {
            ticketId,
            userId,
            imageHash,
            generationsRemaining: updatedRemaining,
            generationsUsed: newGenerationsUsed,
            maxGenerations,
            expiresAt,
            issuedAt: now,
            nonce,
            signature,
          },
          generationsRemaining: updatedRemaining,
          creditsRemaining: credits,
        },
        { headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { success: false, error: `Unsupported handshake action: ${action}` },
      { status: 400, headers: corsHeaders },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Handshake API Route] Internal Error:", err);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${msg}` },
      { status: 500, headers: corsHeaders },
    );
  }
}
