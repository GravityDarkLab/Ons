import { Context } from "hono";
import { processFormSubmission } from "../services/form.service.js";
import type { FormSubmissionInput } from "../validators/form.validator.js";

/**
 * POST /api/v1/form/submit
 */
export async function submitForm(c: Context): Promise<Response> {
  const body = c.req.valid("json" as never) as FormSubmissionInput;

  try {
    const result = await processFormSubmission(body);

    return c.json(
      {
        success: true,
        alias: result.alias,
        applicantId: result.applicantId,
        message: "Your profile has been submitted successfully.",
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed";
    return c.json({ success: false, error: message }, 400);
  }
}
