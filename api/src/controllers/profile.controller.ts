import { Context } from "hono";
import {
  loginWithMagicToken,
  setPassword as setPasswordService,
  changePassword as changePasswordService,
  getMyProfile,
  getMyMatches,
  requestContact,
  respondToContact,
  reportOutcome,
  deactivateMyAccount,
} from "../services/profile.service.js";
import { signApplicantToken } from "../middleware/applicant.auth.middleware.js";
import { generateReadablePassword } from "../privacy/magic-token.js";

export async function login(c: Context): Promise<Response> {
  const { magicToken, password } = c.req.valid("json" as never) as {
    magicToken: string;
    password?: string;
  };

  const result = await loginWithMagicToken(magicToken, password);
  if (result === null) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }
  if (result.status === "first_login") {
    return c.json({ success: true, firstLogin: true });
  }

  const token = await signApplicantToken(
    result.applicant._id.toHexString(),
    result.applicant.alias
  );
  return c.json({ success: true, token });
}

export async function setPassword(c: Context): Promise<Response> {
  const { magicToken, newPassword } = c.req.valid("json" as never) as {
    magicToken: string;
    newPassword: string;
  };

  try {
    const applicant = await setPasswordService(magicToken, newPassword);
    if (!applicant) return c.json({ success: false, error: "Invalid token" }, 401);
    const token = await signApplicantToken(applicant._id.toHexString(), applicant.alias);
    return c.json({ success: true, token });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    const code = (e.statusCode ?? 500) as Parameters<typeof c.json>[1];
    return c.json({ success: false, error: e.message ?? "Error" }, code);
  }
}

export async function changePassword(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const { currentPassword, newPassword } = c.req.valid("json" as never) as {
    currentPassword: string;
    newPassword: string;
  };

  try {
    await changePasswordService(applicantId, currentPassword, newPassword);
    return c.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    const code = (e.statusCode ?? 500) as Parameters<typeof c.json>[1];
    return c.json({ success: false, error: e.message ?? "Error" }, code);
  }
}

export async function suggestPassword(_c: Context): Promise<Response> {
  return _c.json({ success: true, suggestion: generateReadablePassword() });
}

export async function me(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const profile = await getMyProfile(applicantId);
  if (!profile) return c.json({ success: false, error: "Not found" }, 404);
  return c.json({ success: true, data: profile });
}

export async function matches(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const { threshold, limit } = c.req.valid("query" as never) as {
    threshold: number;
    limit: number;
  };
  const data = await getMyMatches(applicantId, threshold, limit);
  return c.json({ success: true, data });
}

function matchErrorResponse(c: Context, err: unknown): Response {
  const e = err as { message?: string; statusCode?: number };
  if (e.statusCode === 404) return c.json({ success: false, error: e.message }, 404);
  if (e.statusCode === 409) return c.json({ success: false, error: e.message }, 409);
  if (e.statusCode === 403) return c.json({ success: false, error: e.message ?? "Forbidden" }, 403);
  return c.json({ success: false, error: "Internal server error" }, 500);
}

export async function contact(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const matchId     = c.req.param("id") as string;
  const ipAddress   = c.req.header("X-Forwarded-For") ?? c.req.header("X-Real-IP") ?? "unknown";
  const userAgent   = c.req.header("User-Agent") ?? "unknown";

  try {
    const result = await requestContact(applicantId, matchId, { ipAddress, userAgent });
    return c.json({ success: true, data: result });
  } catch (err: unknown) {
    return matchErrorResponse(c, err);
  }
}

export async function respond(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const matchId     = c.req.param("id") as string;
  const { accept }  = c.req.valid("json" as never) as { accept: boolean };

  try {
    await respondToContact(applicantId, matchId, accept);
    return c.json({ success: true });
  } catch (err: unknown) {
    return matchErrorResponse(c, err);
  }
}

export async function outcome(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const matchId     = c.req.param("id") as string;
  const { outcome: out } = c.req.valid("json" as never) as {
    outcome: "success" | "failed";
  };

  try {
    await reportOutcome(applicantId, matchId, out);
    return c.json({ success: true });
  } catch (err: unknown) {
    return matchErrorResponse(c, err);
  }
}

export async function deactivate(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  await deactivateMyAccount(applicantId);
  return c.json({ success: true });
}
