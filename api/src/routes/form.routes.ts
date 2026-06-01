import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { formSubmissionSchema } from "../validators/form.validator.js";
import { submitForm, getQuestionnaire } from "../controllers/form.controller.js";
import { formSubmitRateLimiter } from "../middleware/rateLimit.middleware.js";

const formRoutes = new Hono();

// Returns the active questionnaire + a version-bound submission key
formRoutes.get("/questionnaire", getQuestionnaire);

formRoutes.post(
  "/submit",
  formSubmitRateLimiter,
  zValidator("json", formSubmissionSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: z.flattenError(result.error).fieldErrors,
        },
        422
      );
    }
  }),
  submitForm
);

export { formRoutes };
