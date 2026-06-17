import { z } from "zod";
import type { Context } from "hono";

/**
 * Shared zValidator hook: turns any schema failure into the API's
 * standard 422 envelope. Pass as the third argument to zValidator.
 */
export function validationHook(
  result: { success: boolean; error?: unknown },
  c: Context,
): Response | void {
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: "Validation failed",
        details: z.flattenError(result.error as z.ZodError).fieldErrors,
      },
      422,
    );
  }
}
