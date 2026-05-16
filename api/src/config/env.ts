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
  mongodbDbName: optional("MONGODB_DB_NAME", "matching"),
  encryptionKey: validateEncryptionKey(required("ENCRYPTION_KEY")),
  jwtSecret: required("JWT_SECRET"),
  adminUsername: required("ADMIN_USERNAME"),
  adminPassword: required("ADMIN_PASSWORD"),
  allowedOrigins: optional("ALLOWED_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  port: parseInt(optional("PORT", "3001"), 10),
  nodeEnv: optional("NODE_ENV", "development"),
} as const;

export type Env = typeof env;
