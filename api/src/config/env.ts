/**
 * Centralised environment variable loader.
 * Throws on startup if any required variable is missing or invalid.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function validateEncryptionKey(key: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"
    );
  }
  return key;
}

export const env = {
  mongodbUri: required("MONGODB_URI"),
  mongodbDbName: optional("MONGODB_DB_NAME", "ons"),
  encryptionKey: validateEncryptionKey(required("ENCRYPTION_KEY")),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiry: optional("JWT_EXPIRY", "8h"),
  allowedOrigins: optional("ALLOWED_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  // HMAC secret used to sign per-version submission keys — prevents version enumeration.
  // Generate with: openssl rand -hex 32
  formSecret: required("FORM_SECRET"),

  // ── Embedding provider (used only by the "embedding-cosine" algorithm) ──────
  // Providers: openai | local
  // See api/src/matching/embeddings/provider.ts for full documentation.
  embeddingProvider: required("EMBEDDING_PROVIDER") as "openai" | "local",
  embeddingModel: required("EMBEDDING_MODEL"),  // e.g. text-embedding-3-small, text-embedding-embeddinggemma-300m
  embeddingBaseUrl: required("EMBEDDING_BASE_URL"),  // required for local
  openaiApiKey: optional("OPENAI_API_KEY", ""),          // required for openai
  
  // Server config
  port: parseInt(optional("PORT", "3001"), 10),
  nodeEnv: optional("NODE_ENV", "development"),
  // Base URL used in startup logs. Defaults to localhost for dev.
  // Override in test/prod: PUBLIC_URL=https://api.yourdomain.com
  publicUrl: optional("PUBLIC_URL", "").replace(/\/$/, ""),
} as const;

export type Env = typeof env;
