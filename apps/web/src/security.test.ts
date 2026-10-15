import { describe, expect, it } from 'vitest';

import { RequestRateLimiter } from './security.js';

describe('RequestRateLimiter', () => {
  it('limits requests within a window and resets afterward', () => {
    const limiter = new RequestRateLimiter({ windowMs: 1_000, maxRequests: 2 });
    expect(limiter.allow('ip', 100)).toBe(true);
    expect(limiter.allow('ip', 200)).toBe(true);
    expect(limiter.allow('ip', 300)).toBe(false);
    expect(limiter.allow('ip', 1_100)).toBe(true);
  });
});
