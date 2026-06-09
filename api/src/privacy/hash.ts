import { createHmac } from "crypto";
import { env } from "../config/env.js";

export function normalizeInstagram(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

export function hashInstagram(handle: string): string {
  return createHmac("sha256", env.formSecret)
    .update(normalizeInstagram(handle))
    .digest("hex");
}
