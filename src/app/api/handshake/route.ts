import { NextRequest, NextResponse } from 'next/server';

const HANDSHAKE_SECRET =
  process.env.HANDSHAKE_SECRET ||
  process.env.FIREBASE_PRIVATE_KEY ||
  'vz-cryptographic-handshake-secret-key-prod-994';

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  'AIzaSyAJ1he5OrzyuuLy9S3Q6efQmRCQsDV5O-s';

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  'vectorizerr';

/**
 * Computes an HMAC-SHA256 hex signature using Web Crypto API
 */
async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const arr = Array.from(new Uint8Array(signature));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies Firebase Auth ID Token using Google Identity Toolkit REST API
 */
async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email?: string } | null> {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      console.warn('[Handshake API] Token verification failed:', res.status);
      return null;
    }

    const data = (await res.json()) as { users?: Array<{ localId: string; email?: string }> };
    if (!data.users || data.users.length === 0) {
      return null;
    }

    return {
      uid: data.users[0].localId,
      email: data.users[0].email,
    };
  } catch (err) {
    console.error('[Handshake API] Error verifying Firebase token:', err);
    return null;
  }
}

interface FirestoreRestDoc {
  fields?: {
    credits?: { integerValue?: string };
    isAdmin?: { booleanValue?: boolean };
    subscription?: { mapValue?: { fields?: { status?: { stringValue?: string } } } };
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
 * Retrieves a user document from Firestore using REST API
 */
async function getFirestoreUser(userId: string): Promise<FirestoreUserRecord | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const doc = (await res.json()) as FirestoreRestDoc;
    const fields = doc.fields || {};

    return {
      uid: userId,
      credits: fields.credits?.integerValue ? Number(fields.credits.integerValue) : 0,
      isAdmin: Boolean(fields.isAdmin?.booleanValue),
      subscription: fields.subscription?.mapValue?.fields
        ? {
            status: fields.subscription.mapValue.fields.status?.stringValue || 'inactive',
          }
        : { status: 'inactive' },
      unlockedImages: fields.unlockedImages?.mapValue?.fields || {},
    };
  } catch (err) {
    console.error('[Handshake API] Error getting user document:', err);
    return null;
  }
}

/**
 * Atomically updates user in Firestore
 */
async function updateFirestoreUser(
  userId: string,
  newCredits: number,
  unlockedImagesObj: Record<string, unknown>
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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (err) {
    console.error('[Handshake API] Error updating user:', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. App Check verification check (if present)
    const appCheckToken = req.headers.get('X-Firebase-AppCheck');
    const isEnforceAppCheck = process.env.ENFORCE_APPCHECK === 'true';

    if (isEnforceAppCheck && !appCheckToken) {
      return NextResponse.json(
        { success: false, error: 'App Check token required.' },
        { status: 401 }
      );
    }

    // 2. Auth Token verification
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid Authorization header.' },
        { status: 401 }
      );
    }

    const idToken = authHeader.replace('Bearer ', '').trim();
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (!verifiedUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid Firebase authentication token.' },
        { status: 401 }
      );
    }

    const userId = verifiedUser.uid;

    // 3. Parse Handshake Request
    const body = await req.json().catch(() => ({}));
    const { action, imageHash } = body as {
      action: 'unlock_image' | 'consume_generation' | 'verify_ticket';
      imageHash: string;
      ticketId?: string;
    };

    if (!imageHash || typeof imageHash !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing valid imageHash in handshake request.' },
        { status: 400 }
      );
    }

    // 4. Fetch Authentic Server Profile from Firestore
    const userProfile = await getFirestoreUser(userId);
    const credits = userProfile?.credits ?? 0;
    const isAdmin = Boolean(userProfile?.isAdmin);
    const isSubscribed = userProfile?.subscription?.status === 'active';
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
    const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const ticketId = `ticket_${now}_${nonce.slice(0, 8)}`;

    // 5. Handle Action
    if (action === 'unlock_image') {
      // If already unlocked with remaining generations or admin/subscriber
      if (isAdmin || isSubscribed || (existingUnlock && remainingGens > 0)) {
        const quota = isAdmin || isSubscribed ? 9999 : remainingGens;
        const msgToSign = `${ticketId}:${userId}:${imageHash}:${quota}:${expiresAt}:${nonce}`;
        const signature = await computeHmacSha256(HANDSHAKE_SECRET, msgToSign);

        return NextResponse.json({
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
        });
      }

      // Check if user has at least 1 credit
      if (credits < 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient credits to unlock image. Please purchase a credit pack.',
            creditsRemaining: credits,
          },
          { status: 402 }
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
              generationsUsed: { integerValue: '0' },
              maxGenerations: { integerValue: '10' },
              unlockedAt: { integerValue: String(now) },
            },
          },
        },
      };

      await updateFirestoreUser(userId, newCredits, updatedUnlocked);

      const msgToSign = `${ticketId}:${userId}:${imageHash}:10:${expiresAt}:${nonce}`;
      const signature = await computeHmacSha256(HANDSHAKE_SECRET, msgToSign);

      return NextResponse.json({
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
      });
    } else if (action === 'consume_generation') {
      if (isAdmin || isSubscribed) {
        const msgToSign = `${ticketId}:${userId}:${imageHash}:9999:${expiresAt}:${nonce}`;
        const signature = await computeHmacSha256(HANDSHAKE_SECRET, msgToSign);
        return NextResponse.json({
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
        });
      }

      if (!existingUnlock || remainingGens <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No generations remaining for this image. Please unlock with 1 credit.',
            generationsRemaining: 0,
          },
          { status: 403 }
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
              unlockedAt: { integerValue: existingUnlock?.unlockedAt?.integerValue || String(now) },
            },
          },
        },
      };

      await updateFirestoreUser(userId, credits, updatedUnlocked);

      const msgToSign = `${ticketId}:${userId}:${imageHash}:${updatedRemaining}:${expiresAt}:${nonce}`;
      const signature = await computeHmacSha256(HANDSHAKE_SECRET, msgToSign);

      return NextResponse.json({
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
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported handshake action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Handshake API Route] Internal Error:', err);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${msg}` },
      { status: 500 }
    );
  }
}
