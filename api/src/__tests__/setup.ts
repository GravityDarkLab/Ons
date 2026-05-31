/**
 * Preloaded before every test file via `bun test --preload`.
 * Sets required env vars so env.ts evaluates without throwing.
 */
process.env.MONGODB_URI = "mongodb://localhost:27017/ons_test";
process.env.ENCRYPTION_KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // 64 hex chars
process.env.JWT_SECRET = "super-secret-jwt-key-for-testing-only";
process.env.FORM_SECRET = "form-secret-hex-string-for-testing-purposes-only-64chars-padding";
process.env.EMBEDDING_PROVIDER = "local";
process.env.EMBEDDING_MODEL = "nomic-embed-text";
process.env.EMBEDDING_BASE_URL = "http://localhost:1234/v1";
