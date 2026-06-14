import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { validationHook } from "../validators/validation-hook.js";
import { patchMatchSchema } from "../validators/match.validator.js";
import { getMatches, patchMatch, removeMatch } from "../controllers/match.controller.js";

const matchRoutes = new Hono();

// All match routes require admin auth
matchRoutes.use("*", requireAdmin);

matchRoutes.get("/", getMatches);

matchRoutes.patch(
  "/:id",
  zValidator("json", patchMatchSchema, validationHook),
  patchMatch,
);

matchRoutes.delete("/:id", removeMatch);

export { matchRoutes };
