import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/app.config', () => ({
  APP_CONFIG: { debugSecret: '', testnetSecret: '' },
}));

import { buildApiHeaders } from '../lib/api-headers';

describe('buildApiHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Content-Type application/json with no options', () => {
    const headers = buildApiHeaders();
    expect(headers['Content-Type']).toBe('application/json');
    expect(Object.keys(headers)).toHaveLength(1);
  });

  it('includes Authorization Bearer when idToken is provided', () => {
    const headers = buildApiHeaders({ idToken: 'my-token' });
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  it('includes X-Firebase-AppCheck when appCheckToken is provided', () => {
    const headers = buildApiHeaders({ appCheckToken: 'app-check-token-123' });
    expect(headers['X-Firebase-AppCheck']).toBe('app-check-token-123');
  });

  it('does NOT include X-Firebase-AppCheck when appCheckToken is null', () => {
    const headers = buildApiHeaders({ appCheckToken: null });
    expect(headers).not.toHaveProperty('X-Firebase-AppCheck');
  });

  it('does NOT include debug or testnet headers when secrets are empty strings', () => {
    const headers = buildApiHeaders();
    expect(headers).not.toHaveProperty('X-Debug-Secret');
    expect(headers).not.toHaveProperty('X-Testnet-Secret');
  });

  it('includes both Authorization and AppCheck when both are provided', () => {
    const headers = buildApiHeaders({
      idToken: 'token-abc',
      appCheckToken: 'check-xyz',
    });
    expect(headers['Authorization']).toBe('Bearer token-abc');
    expect(headers['X-Firebase-AppCheck']).toBe('check-xyz');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
