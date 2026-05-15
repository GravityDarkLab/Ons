import { Context, Next } from "hono";

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * Simple in-memory sliding window rate limiter.
 *
 * Each unique key (IP address) gets a window of `windowMs` milliseconds
 * and at most `maxRequests` requests per window.
 *
 * Memory is bounded: old timestamps are evicted on each check.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyFn?: (c: Context) => string;
  message?: string;
}) {
  const {
    windowMs,
    maxRequests,
    keyFn,
    message = "Too many requests. Please try again later.",
  } = options;

  const store = new Map<string, RateLimitRecord>();

  // Periodically clean up stale entries (every 5 minutes)
  const cleanup = setInterval(() => {
    const now = Date.now();
    const cutoff = now - windowMs;
    for (const [key, record] of store) {
      record.timestamps = record.timestamps.filter((t) => t > cutoff);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Allow GC to collect — don't block process exit
  if (cleanup.unref) cleanup.unref();

  return async function rateLimitMiddleware(
    c: Context,
    next: Next
  ): Promise<Response | void> {
    const key = keyFn
      ? keyFn(c)
      : (c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
        c.req.header("x-real-ip") ??
        "unknown");

    const now = Date.now();
    const cutoff = now - windowMs;

    const record = store.get(key) ?? { timestamps: [] };

    // Evict expired timestamps
    record.timestamps = record.timestamps.filter((t) => t > cutoff);

    if (record.timestamps.length >= maxRequests) {
      const resetAt = record.timestamps[0] + windowMs;
      const retryAfterSecs = Math.ceil((resetAt - now) / 1000);

      c.header("X-RateLimit-Limit", String(maxRequests));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
      c.header("Retry-After", String(retryAfterSecs));

      return c.json({ success: false, error: message }, 429);
    }

    record.timestamps.push(now);
    store.set(key, record);

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header(
      "X-RateLimit-Remaining",
      String(maxRequests - record.timestamps.length)
    );

    await next();
  };
}

/**
 * Rate limiter for public form submission: 100 requests per 10 minutes.
 */
export const formSubmitRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 100,
  message: "Too many form submissions. Please wait before trying again.",
});

/**
 * Rate limiter for admin endpoints: 20 requests per minute.
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "Too many admin requests. Please wait before trying again.",
});
