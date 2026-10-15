import { describe, expect, it, vi } from 'vitest';

import { createDnsClient } from './index.js';

describe('CloudflareDnsClient', () => {
  it('creates a DNS record when missing', async () => {
    const fetchFn = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ result: [] }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          result: {
            id: 'rec_1',
            name: 'www.example.com',
            type: 'A',
            content: '1.2.3.4',
            proxied: true,
            ttl: 1,
          },
        }),
      } as Response);
    });

    const client = createDnsClient({ apiToken: 'abc', zoneId: 'zone_1', zoneName: 'example.com', dryRun: false, fetchFn });
    const result = await client.ensureRecord({ name: 'www', type: 'A', content: '1.2.3.4', proxied: true, ttl: 1 });

    expect(result.created).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('/dns_records'), expect.objectContaining({ method: 'POST' }));
  });

  it('does not duplicate a record if one is already present', async () => {
    const fetchFn = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        result: [{ id: 'rec_1', name: 'www.example.com', type: 'A', content: '1.2.3.4', proxied: true, ttl: 1 }],
      }),
    } as Response));

    const client = createDnsClient({ apiToken: 'abc', zoneId: 'zone_1', zoneName: 'example.com', dryRun: false, fetchFn });
    const result = await client.ensureRecord({ name: 'www', type: 'A', content: '1.2.3.4', proxied: true, ttl: 1 });

    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('updates a record when the content changes', async () => {
    const fetchFn = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            result: [{ id: 'rec_1', name: 'www.example.com', type: 'A', content: '1.2.3.3', proxied: true, ttl: 1 }],
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          result: { id: 'rec_1', name: 'www.example.com', type: 'A', content: '1.2.3.4', proxied: true, ttl: 1 },
        }),
      } as Response);
    });

    const client = createDnsClient({ apiToken: 'abc', zoneId: 'zone_1', zoneName: 'example.com', dryRun: false, fetchFn });
    const result = await client.ensureRecord({ name: 'www', type: 'A', content: '1.2.3.4', proxied: true, ttl: 1 });

    expect(result.updated).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('/dns_records/rec_1'), expect.objectContaining({ method: 'PUT' }));
  });

  it('retries after a 429 response', async () => {
    const fetchFn = vi.fn(() => {
      if (fetchFn.mock.calls.length === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ errors: [{ code: 'rate_limited', message: 'rate limited' }] }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: [] }),
      } as Response);
    });

    const client = createDnsClient({ apiToken: 'abc', zoneId: 'zone_1', zoneName: 'example.com', dryRun: false, fetchFn });
    const result = await client.listRecords();

    expect(result).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('logs a dry-run mutation without calling the network', async () => {
    const fetchFn = vi.fn();
    const client = createDnsClient({ apiToken: 'abc', zoneId: 'zone_1', zoneName: 'example.com', dryRun: true, fetchFn });
    const result = await client.ensureRecord({ name: 'www', type: 'A', content: '1.2.3.4', proxied: true, ttl: 1 });

    expect(result.dryRun).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
