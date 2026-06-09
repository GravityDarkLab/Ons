import { Context } from "hono";
import {
  loginWithMagicToken,
  getMyProfile,
  getMyMatches,
  requestContact,
  respondToContact,
  reportOutcome,
  deactivateMyAccount,
} from "../services/profile.service.js";
import { signApplicantToken } from "../middleware/applicant.auth.middleware.js";

export async function login(c: Context): Promise<Response> {
  const { magicToken, password } = c.req.valid("json" as never) as {
    magicToken: string;
    password: string;
  };

  const applicant = await loginWithMagicToken(magicToken, password);
  if (!applicant) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  const token = await signApplicantToken(applicant._id.toHexString(), applicant.alias);
  return c.json({ success: true, token });
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

export async function contact(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  const matchId     = c.req.param("id") as string;

  try {
    const result = await requestContact(applicantId, matchId);
    return c.json({ success: true, data: result });
  } catch (err: unknown) {
    const e = err as { message?: string; statusCode?: number };
    if (e.statusCode === 404) return c.json({ success: false, error: e.message }, 404);
    return c.json({ success: false, error: e.message ?? "Forbidden" }, 403);
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
    const e = err as { message?: string; statusCode?: number };
    if (e.statusCode === 404) return c.json({ success: false, error: e.message }, 404);
    return c.json({ success: false, error: e.message ?? "Forbidden" }, 403);
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
    const e = err as { message?: string; statusCode?: number };
    if (e.statusCode === 404) return c.json({ success: false, error: e.message }, 404);
    return c.json({ success: false, error: e.message ?? "Forbidden" }, 403);
  }
}

export async function deactivate(c: Context): Promise<Response> {
  const applicantId = c.get("applicantId") as string;
  await deactivateMyAccount(applicantId);
  return c.json({ success: true });
}
