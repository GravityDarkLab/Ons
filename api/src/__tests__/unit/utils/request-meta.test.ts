import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { getClientIp, getRequestMeta } from "../../../utils/request-meta.js";

function makeApp() {
  const app = new Hono();
  app.get("/ip", (c) => c.json({ ip: getClientIp(c) }));
  app.get("/meta", (c) => c.json(getRequestMeta(c)));
  return app;
}

describe("getClientIp", () => {
  it("prefers X-Forwarded-For over X-Real-IP", async () => {
    const app = makeApp();
    const res = await app.request("/ip", {
      headers: { "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" },
    });
    expect((await res.json()).ip).toBe("1.2.3.4");
  });

  it("takes only the first IP from a comma-separated X-Forwarded-For chain", async () => {
    const app = makeApp();
    const res = await app.request("/ip", {
      headers: { "x-forwarded-for": "1.2.3.4, 9.9.9.9, 8.8.8.8" },
    });
    expect((await res.json()).ip).toBe("1.2.3.4");
  });

  it("falls back to X-Real-IP when X-Forwarded-For is absent", async () => {
    const app = makeApp();
    const res = await app.request("/ip", { headers: { "x-real-ip": "5.6.7.8" } });
    expect((await res.json()).ip).toBe("5.6.7.8");
  });

  it("falls back to 'unknown' when no headers and no real socket are present (test client)", async () => {
    const app = makeApp();
    const res = await app.request("/ip");
    // getConnInfo throws outside a real Bun server (Hono's in-memory test client) —
    // getClientIp must degrade to "unknown" rather than crashing the request.
    expect(res.status).toBe(200);
    expect((await res.json()).ip).toBe("unknown");
  });
});

describe("getRequestMeta", () => {
  it("returns both ipAddress and userAgent", async () => {
    const app = makeApp();
    const res = await app.request("/meta", {
      headers: { "x-forwarded-for": "1.2.3.4", "user-agent": "TestAgent/1.0" },
    });
    expect(await res.json()).toEqual({ ipAddress: "1.2.3.4", userAgent: "TestAgent/1.0" });
  });

  it("defaults userAgent to 'unknown' when absent", async () => {
    const app = makeApp();
    const res = await app.request("/meta", { headers: { "x-forwarded-for": "1.2.3.4" } });
    expect((await res.json()).userAgent).toBe("unknown");
  });
});
