import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { formSubmissionSchema } from "../validators/form.validator.js";
import { submitForm } from "../controllers/form.controller.js";
import { formSubmitRateLimiter } from "../middleware/rateLimit.middleware.js";

const formRoutes = new Hono();

formRoutes.post(
  "/submit",
  formSubmitRateLimiter,
  zValidator("json", formSubmissionSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        422
      );
    }
  }),
  submitForm
);

export { formRoutes };
