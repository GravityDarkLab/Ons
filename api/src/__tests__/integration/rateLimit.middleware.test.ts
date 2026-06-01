import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { createRateLimiter } from "../../middleware/rateLimit.middleware.js";

/** Creates a fresh app with a rate limiter so each test gets an isolated in-memory store. */
function makeApp(maxRequests: number, windowMs = 60_000, keyFn?: (c: any) => string) {
  const app = new Hono();
  const limiter = createRateLimiter({ windowMs, maxRequests, keyFn });
  app.get("/test", limiter, (c) => c.json({ ok: true }));
  return app;
}

async function hit(app: Hono, ip = "1.2.3.4") {
  return app.request("/test", { headers: { "x-forwarded-for": ip } });
}

describe("createRateLimiter — basic enforcement", () => {
  it("allows requests up to the limit", async () => {
    const app = makeApp(3);
    for (let i = 0; i < 3; i++) {
      const res = await hit(app);
      expect(res.status).toBe(200);
    }
  });

  it("blocks the (limit + 1)th request with 429", async () => {
    const app = makeApp(3);
    for (let i = 0; i < 3; i++) await hit(app);
    const res = await hit(app);
    expect(res.status).toBe(429);
  });

  it("returns error body with success=false and a message", async () => {
    const app = makeApp(1);
    await hit(app);
    const res = await hit(app);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });
});

describe("createRateLimiter — response headers", () => {
  it("sets X-RateLimit-Limit header on passing requests", async () => {
    const app = makeApp(5);
    const res = await hit(app);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
  });

  it("X-RateLimit-Remaining decrements with each request", async () => {
    const app = makeApp(5);
    const first  = await hit(app);
    const second = await hit(app);
    expect(first.headers.get("X-RateLimit-Remaining")).toBe("4");
    expect(second.headers.get("X-RateLimit-Remaining")).toBe("3");
  });

  it("sets Retry-After header on 429 response", async () => {
    const app = makeApp(1);
    await hit(app);
    const res = await hit(app);
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("sets X-RateLimit-Reset header on 429 response", async () => {
    const app = makeApp(1);
    await hit(app);
    const res = await hit(app);
    expect(res.headers.get("X-RateLimit-Reset")).not.toBeNull();
  });
});

describe("createRateLimiter — per-key isolation", () => {
  it("tracks different IP addresses independently", async () => {
    const app = makeApp(2);
    // Exhaust IP A
    await hit(app, "10.0.0.1");
    await hit(app, "10.0.0.1");
    const blockedA = await hit(app, "10.0.0.1");
    expect(blockedA.status).toBe(429);

    // IP B should still be allowed
    const okB = await hit(app, "10.0.0.2");
    expect(okB.status).toBe(200);
  });

  it("custom keyFn groups requests by custom key", async () => {
    const app = makeApp(1, 60_000, () => "shared-key");
    // Both requests share the same key regardless of IP
    await hit(app, "1.1.1.1");
    const res = await hit(app, "2.2.2.2");
    expect(res.status).toBe(429);
  });
});

describe("createRateLimiter — window expiry", () => {
  it("allows new requests after the window expires", async () => {
    // Use a very short window (100ms) to test expiry
    const app = makeApp(1, 100);
    await hit(app);
    const blocked = await hit(app);
    expect(blocked.status).toBe(429);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 150));

    const allowed = await hit(app);
    expect(allowed.status).toBe(200);
  });
});

describe("createRateLimiter — edge cases", () => {
  it("uses 'unknown' as fallback key when no IP headers present", async () => {
    const app = makeApp(1);
    // Request with no IP headers — first should pass
    const res1 = await app.request("/test");
    expect(res1.status).toBe(200);
    // Second should be rate limited (same 'unknown' key)
    const res2 = await app.request("/test");
    expect(res2.status).toBe(429);
  });

  it("custom message appears in 429 response body", async () => {
    const app = new Hono();
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      message: "Custom rate limit message",
    });
    app.get("/test", limiter, (c) => c.json({ ok: true }));

    await hit(app);
    const res = await hit(app);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Custom rate limit message");
  });
});
