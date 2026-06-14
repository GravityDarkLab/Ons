import type { Context } from "hono";
import { AppError } from "../errors.js";

/**
 * Standard error response for controller catch blocks. `AppError`s are
 * returned with their own message and status code; anything else falls back
 * to a generic message so unexpected internal errors are never leaked to
 * the client.
 */
export function errorResponse(
  c: Context,
  err: unknown,
  fallbackMessage = "Internal server error",
  fallbackStatus = 500,
): Response {
  if (err instanceof AppError) {
    return c.json(
      { success: false, error: err.message },
      err.statusCode as Parameters<typeof c.json>[1],
    );
  }
  return c.json(
    { success: false, error: fallbackMessage },
    fallbackStatus as Parameters<typeof c.json>[1],
  );
}
