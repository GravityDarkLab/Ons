import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { formSubmissionSchema } from "../validators/form.validator.js";
import { validationHook } from "../validators/validation-hook.js";
import { submitForm, getQuestionnaire } from "../controllers/form.controller.js";
import { formSubmitRateLimiter } from "../middleware/rateLimit.middleware.js";

const formRoutes = new Hono();

// Returns the active questionnaire + a version-bound submission key
formRoutes.get("/questionnaire", getQuestionnaire);

formRoutes.post(
  "/submit",
  formSubmitRateLimiter,
  zValidator("json", formSubmissionSchema, validationHook),
  submitForm
);

export { formRoutes };
