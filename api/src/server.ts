/**
 * Entry point for the matching platform backend.
 * Uses Hono with Bun's native HTTP server via the `export default { fetch }` pattern.
 */

// Load and validate environment variables first — throws on misconfiguration
import { env } from "./config/env.js";

import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { swaggerUI } from "@hono/swagger-ui";
import { buildCorsMiddleware } from "./config/cors.js";
import { getDb } from "./db/connection.js";
import { ensureIndexes } from "./db/collections.js";
import { formRoutes } from "./routes/form.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { matchingRoutes } from "./routes/matching.routes.js";

const API_PREFIX_V1 = "/api/v1";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", buildCorsMiddleware());

// Docs — dev and test only
if (env.nodeEnv !== "production") {
  const specPath = new URL("../docs/openapi.yaml", import.meta.url).pathname;
  const specText = await Bun.file(specPath).text();
  const yaml = await import("js-yaml");
  const spec = yaml.load(specText);

  app.get(API_PREFIX_V1 + "/docs", swaggerUI({ url: API_PREFIX_V1 + "/openapi.json" }));
  app.get(API_PREFIX_V1 + "/openapi.json", (c) => c.json(spec));
}

// Health check — no auth, no rate limit
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: env.nodeEnv,
  });
});

// API routes
app.route(API_PREFIX_V1 + "/form", formRoutes);
app.route(API_PREFIX_V1 + "/admin", adminRoutes);
app.route(API_PREFIX_V1 + "/matching", matchingRoutes);

// Global 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: "Nothing here" }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error("[SERVER] Unhandled error:", err);
  return c.json(
    { success: false, error: "Internal server error" },
    500
  );
});

// Connect to DB and ensure indexes before serving
async function bootstrap() {
  try {
    const db = await getDb();
    await ensureIndexes(db);
    console.log(`[SERVER] Starting on port ${env.port}...`);
  } catch (err) {
    console.error("[SERVER] Fatal startup error:", err);
    process.exit(1);
  }
}

await bootstrap();

const base = env.publicUrl || `http://localhost:${env.port}`;

console.info(`[SERVER] Server started in ${env.nodeEnv} mode and ready to work!`);
if (env.nodeEnv !== "production") {
  console.info(`[SERVER] API docs    → ${base}${API_PREFIX_V1}/docs`);
  console.info(`[SERVER] Health      → ${base}/health`);
}

// Bun native serve — no @hono/node-server needed
export default {
  port: env.port,
  fetch: app.fetch,
};
