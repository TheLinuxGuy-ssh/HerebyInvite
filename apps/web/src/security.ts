import type { IncomingMessage } from 'node:http';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export class RequestRateLimiter {
  private readonly requests = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly options: RateLimitOptions) {}

  allow(key: string, now = Date.now()): boolean {
    const current = this.requests.get(key);
    if (!current || current.resetAt <= now) {
      this.requests.set(key, { count: 1, resetAt: now + this.options.windowMs });
      return true;
    }
    if (current.count >= this.options.maxRequests) return false;
    current.count += 1;
    return true;
  }
}

export function requestAddress(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.socket.remoteAddress ?? 'unknown';
}

export function applySecurityHeaders(response: { setHeader(name: string, value: string): void }): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
}
