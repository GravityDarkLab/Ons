/**
 * Entry point for the matching platform backend.
 * Uses Hono with Bun's native HTTP server via the `export default { fetch }` pattern.
 */

// Load and validate environment variables first — throws on misconfiguration
import { env } from "./config/env.js";

import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { buildCorsMiddleware } from "./config/cors.js";
import { getDb } from "./db/connection.js";
import { ensureIndexes } from "./db/collections.js";
import { formRoutes } from "./routes/form.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { matchingRoutes } from "./routes/matching.routes.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", buildCorsMiddleware());

// Health check — no auth, no rate limit
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: env.nodeEnv,
  });
});

// API routes
app.route("/api/v1/form", formRoutes);
app.route("/api/v1/admin", adminRoutes);
app.route("/api/v1/matching", matchingRoutes);

// Global 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: "Route not found" }, 404);
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

console.log(`[SERVER] Listening on http://localhost:${env.port}`);

// Bun native serve — no @hono/node-server needed
export default {
  port: env.port,
  fetch: app.fetch,
};
