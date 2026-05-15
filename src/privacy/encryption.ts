import crypto from "crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // bytes
const TAG_LENGTH = 16; // bytes — GCM auth tag

/**
 * Returns the 32-byte key buffer derived from the hex ENCRYPTION_KEY env var.
 */
function getKeyBuffer(): Buffer {
  return Buffer.from(env.encryptionKey, "hex");
}

export interface EncryptResult {
  encrypted: string; // hex-encoded ciphertext
  iv: string;        // hex-encoded IV
  tag: string;       // hex-encoded auth tag
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * A fresh random IV is generated for each encryption call.
 */
export function encrypt(plaintext: string): EncryptResult {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  }) as crypto.CipherGCM;

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

/**
 * Decrypts a ciphertext previously produced by `encrypt`.
 * Throws if authentication fails (tampered data).
 */
export function decrypt(
  encryptedHex: string,
  ivHex: string,
  tagHex: string
): string {
  const key = getKeyBuffer();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encryptedData = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  }) as crypto.DecipherGCM;

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
