export type DnsRecordType = 'A' | 'CNAME';

export interface DnsRecord {
  id?: string;
  name: string;
  type: DnsRecordType;
  content: string;
  proxied: boolean;
  ttl: number;
}

export interface EnsureRecordInput {
  name: string;
  type: DnsRecordType;
  content: string;
  proxied: boolean;
  ttl: number;
}

export interface DeleteRecordInput {
  name: string;
  type: DnsRecordType;
  content?: string;
}

export interface ListRecordsOptions {
  type?: DnsRecordType;
  name?: string;
}

export interface DnsOperationResult {
  ok: true;
  dryRun: boolean;
  created: boolean;
  updated: boolean;
  record: DnsRecord;
}

export class CloudflareApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CloudflareApiError';
  }
}

export interface CloudflareDnsClientOptions {
  apiToken?: string;
  zoneId?: string;
  zoneName?: string;
  dryRun?: boolean;
  fetchFn?: typeof fetch;
}

function toHttpName(name: string, zoneName: string): string {
  const normalized = name.trim().replace(/\.$/, '');
  if (normalized === zoneName) {
    return zoneName;
  }
  return normalized.endsWith(`.${zoneName}`) ? normalized : `${normalized}.${zoneName}`;
}

function stripZoneSuffix(name: string, zoneName: string): string {
  const base = name.trim().replace(/\.$/, '');
  if (base === zoneName) {
    return zoneName;
  }
  return base.endsWith(`.${zoneName}`) ? base.slice(0, -zoneName.length - 1) : base;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export class CloudflareDnsClient {
  private readonly apiToken: string;
  private readonly zoneId: string;
  private readonly zoneName: string;
  private readonly dryRun: boolean;
  private readonly fetchFn: typeof fetch;

  constructor(options: CloudflareDnsClientOptions = {}) {
    this.apiToken = options.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? '';
    this.zoneId = options.zoneId ?? process.env.CLOUDFLARE_ZONE_ID ?? '';
    this.zoneName = options.zoneName ?? process.env.CLOUDFLARE_ZONE_NAME ?? 'herebyinvited.tech';
    this.dryRun = options.dryRun ?? (process.env.DNS_DRY_RUN ?? 'true') === 'true';
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async listRecords(options: ListRecordsOptions = {}): Promise<DnsRecord[]> {
    if (!this.zoneId) {
      throw new CloudflareApiError('missing_zone_id', 400, 'CLOUDFLARE_ZONE_ID is required.');
    }

    const query = new URLSearchParams();
    if (options.type) {
      query.set('type', options.type);
    }
    if (options.name) {
      query.set('name', toHttpName(options.name, this.zoneName));
    }

    const url = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records${query.size > 0 ? `?${query.toString()}` : ''}`;
    const payload = await this.request<{ result?: Array<Record<string, unknown>> }>(url, {
      method: 'GET',
    });

    return (payload.result ?? []).map((record) => ({
      id: asString(record.id),
      name: asString(record.name),
      type: (asString(record.type, 'A') as DnsRecordType),
      content: asString(record.content),
      proxied: Boolean(record.proxied),
      ttl: asNumber(record.ttl, 1),
    }));
  }

  async ensureRecord(input: EnsureRecordInput): Promise<DnsOperationResult> {
    if (this.dryRun) {
      const record: DnsRecord = {
        name: toHttpName(input.name, this.zoneName),
        type: input.type,
        content: input.content,
        proxied: input.proxied,
        ttl: input.ttl,
      };
      return { ok: true, dryRun: true, created: true, updated: false, record };
    }

    const records = await this.listRecords({ type: input.type, name: input.name });
    const targetName = toHttpName(input.name, this.zoneName);
    const existing = records.find((record) => record.name === targetName && record.type === input.type);

    if (!existing) {
      const created = await this.request<{ result?: Record<string, unknown> }>(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: input.type,
          name: stripZoneSuffix(targetName, this.zoneName),
          content: input.content,
          proxied: input.proxied,
          ttl: input.ttl,
        }),
      });

      const record = {
        id: asString(created.result?.id),
        name: asString(created.result?.name, targetName),
        type: (asString(created.result?.type, input.type) as DnsRecordType),
        content: asString(created.result?.content, input.content),
        proxied: Boolean(created.result?.proxied ?? input.proxied),
        ttl: asNumber(created.result?.ttl, input.ttl),
      };

      return { ok: true, dryRun: false, created: true, updated: false, record };
    }

    const needsUpdate = existing.content !== input.content || existing.proxied !== input.proxied || existing.ttl !== input.ttl;
    if (!needsUpdate) {
      return { ok: true, dryRun: false, created: false, updated: false, record: existing };
    }

    const updated = await this.request<{ result?: Record<string, unknown> }>(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records/${existing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: input.type,
        name: stripZoneSuffix(targetName, this.zoneName),
        content: input.content,
        proxied: input.proxied,
        ttl: input.ttl,
      }),
    });

    const record = {
      id: asString(updated.result?.id, existing.id ?? ''),
      name: asString(updated.result?.name, targetName),
      type: (asString(updated.result?.type, input.type) as DnsRecordType),
      content: asString(updated.result?.content, input.content),
      proxied: Boolean(updated.result?.proxied ?? input.proxied),
      ttl: asNumber(updated.result?.ttl, input.ttl),
    };

    return { ok: true, dryRun: false, created: false, updated: true, record };
  }

  async deleteRecord(input: DeleteRecordInput): Promise<{ ok: true; dryRun: boolean; deleted: boolean; count: number }> {
    if (this.dryRun) {
      return { ok: true, dryRun: true, deleted: true, count: 1 };
    }

    const records = await this.listRecords({ type: input.type, name: input.name });
    const matching = records.filter((record) => {
      const sameType = record.type === input.type;
      const sameName = record.name === toHttpName(input.name, this.zoneName);
      const sameContent = input.content ? record.content === input.content : true;
      return sameType && sameName && sameContent;
    });

    for (const record of matching) {
      if (!record.id) {
        continue;
      }
      await this.request(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records/${record.id}`, { method: 'DELETE' });
    }

    return { ok: true, dryRun: false, deleted: matching.length > 0, count: matching.length };
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${this.apiToken}`);

    const run = async (): Promise<T> => {
      const response = await this.fetchFn(url, { ...init, headers });
      if (response.ok) {
        return (await response.json()) as T;
      }

      const payload = (await response.json().catch(() => null)) as { errors?: Array<{ code?: string; message?: string }> } | null;
      const error = payload?.errors?.[0];
      throw new CloudflareApiError(error?.code ?? 'cloudflare_error', response.status, error?.message ?? `Request failed with status ${response.status}`);
    };

    for (let attempt = 0; attempt <= 3; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        const apiError = error as CloudflareApiError;
        const isRetryable = apiError instanceof CloudflareApiError && (apiError.status === 429 || apiError.status >= 500);
        if (!isRetryable || attempt >= 3) {
          throw error;
        }
        await delay(250 * 2 ** attempt);
      }
    }

    throw new CloudflareApiError('retry_exhausted', 500, 'Retry attempts exhausted.');
  }
}

export function createDnsClient(options: CloudflareDnsClientOptions = {}): CloudflareDnsClient {
  return new CloudflareDnsClient(options);
}

export const dnsClient = createDnsClient();
