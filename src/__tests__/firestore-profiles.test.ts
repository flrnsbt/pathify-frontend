import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external firebase deps before importing the module under test
vi.mock('../lib/firebase/config', () => ({
  db: {},
  auth: { currentUser: null },
  getAppCheckToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('../lib/firebase/auth-context', () => ({
  handleAuthExpired: vi.fn(),
}));

vi.mock('../lib/security/handshake', () => ({
  hasValidSessionTicket: vi.fn().mockReturnValue(false),
  getSessionTicket: vi.fn().mockReturnValue(null),
  requestServerHandshake: vi.fn(),
}));

vi.mock('../lib/app-config', () => ({
  getGenerationsPerUnlock: vi.fn().mockReturnValue(10),
}));

// Mock heavy firebase/firestore SDK so it never loads
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getCountFromServer: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('@fingerprintjs/fingerprintjs', () => ({
  default: { load: vi.fn().mockResolvedValue({ get: vi.fn().mockResolvedValue({ visitorId: 'test' }) }) },
}));

vi.mock('../lib/vtracer/compression', () => ({
  compressSvgString: vi.fn(),
  decompressSvgString: vi.fn(),
  decompressSvgBytes: vi.fn(),
}));

vi.mock('@/config/app.config', () => ({
  APP_CONFIG: {
    debugSecret: '',
    testnetSecret: '',
    api: { refreshCreditsUrl: '', handshakeUrl: '', saveHistoryUrl: '', appConfigUrl: '' },
  },
}));

vi.mock('../lib/api-headers', () => ({
  buildApiHeaders: vi.fn().mockReturnValue({ 'Content-Type': 'application/json' }),
}));

import { getImageUnlockStatus, canAccessSvg, type UserProfile } from '../lib/firebase/firestore';
import { hasValidSessionTicket } from '../lib/security/handshake';

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  uid: 'test-uid',
  credits: 5,
  isAdmin: false,
  isPro: false,
  subscription: { status: 'inactive' },
  updatedAt: Date.now(),
  ...overrides,
});

describe('getImageUnlockStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no valid session ticket (mock is set at module level via vi.mock)
    vi.mocked(hasValidSessionTicket).mockReturnValue(false);
  });

  it('returns isUnlocked=false and generationsRemaining=0 when profile is null', () => {
    const result = getImageUnlockStatus(null, 'img-hash');
    expect(result.isUnlocked).toBe(false);
    expect(result.generationsRemaining).toBe(0);
  });

  it('returns isUnlocked=false and generationsRemaining=0 when imageHash is missing', () => {
    const profile = makeProfile();
    const result = getImageUnlockStatus(profile, undefined);
    expect(result.isUnlocked).toBe(false);
    expect(result.generationsRemaining).toBe(0);
  });

  it('returns isUnlocked=true and generationsRemaining=9999 for active subscriber', () => {
    const profile = makeProfile({ subscription: { status: 'active' } });
    const result = getImageUnlockStatus(profile, 'img-hash');
    expect(result.isUnlocked).toBe(true);
    expect(result.generationsRemaining).toBe(9999);
  });

  it('returns correct remaining count when image is unlocked with quota', () => {
    const profile = makeProfile({
      unlockedImages: {
        'img-hash': {
          imageHash: 'img-hash',
          generationsUsed: 3,
          maxGenerations: 10,
          unlockedAt: Date.now(),
        },
      },
    });
    const result = getImageUnlockStatus(profile, 'img-hash');
    expect(result.isUnlocked).toBe(true);
    expect(result.generationsRemaining).toBe(7);
    expect(result.generationsUsed).toBe(3);
  });

  it('returns isUnlocked=false when quota is fully used', () => {
    const profile = makeProfile({
      unlockedImages: {
        'img-hash': {
          imageHash: 'img-hash',
          generationsUsed: 10,
          maxGenerations: 10,
          unlockedAt: Date.now(),
        },
      },
    });
    const result = getImageUnlockStatus(profile, 'img-hash');
    expect(result.isUnlocked).toBe(false);
    expect(result.generationsRemaining).toBe(0);
  });
});

describe('canAccessSvg', () => {
  it('returns false when profile is null', () => {
    expect(canAccessSvg(null, 'img-hash')).toBe(false);
  });

  it('returns true for active subscriber', () => {
    const profile = makeProfile({ subscription: { status: 'active' } });
    expect(canAccessSvg(profile, 'img-hash')).toBe(true);
  });

  it('returns false when image is not unlocked', () => {
    const profile = makeProfile();
    expect(canAccessSvg(profile, 'unknown-hash')).toBe(false);
  });

  it('returns true when image is unlocked and has remaining quota', () => {
    const profile = makeProfile({
      unlockedImages: {
        'img-hash': {
          imageHash: 'img-hash',
          generationsUsed: 2,
          maxGenerations: 10,
          unlockedAt: Date.now(),
        },
      },
    });
    expect(canAccessSvg(profile, 'img-hash')).toBe(true);
  });

  it('returns false when image unlock quota is exhausted', () => {
    const profile = makeProfile({
      unlockedImages: {
        'img-hash': {
          imageHash: 'img-hash',
          generationsUsed: 10,
          maxGenerations: 10,
          unlockedAt: Date.now(),
        },
      },
    });
    expect(canAccessSvg(profile, 'img-hash')).toBe(false);
  });
});
