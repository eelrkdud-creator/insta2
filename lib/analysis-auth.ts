import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ANALYSIS_AUTH_COOKIE = "insta2_analysis_access";

function configuredPassword() {
  return process.env.ANALYSIS_PASSWORD || "iwink";
}

function accessToken() {
  const secret =
    process.env.POST_RESULT_SIGNING_SECRET ||
    process.env.DATABASE_URL ||
    configuredPassword();
  return createHash("sha256")
    .update(`insta2-analysis:${configuredPassword()}:${secret}`)
    .digest("hex");
}

export function matchesAnalysisPassword(value: unknown) {
  if (typeof value !== "string") return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(configuredPassword());
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function hasAnalysisAccess() {
  try {
    return (await cookies()).get(ANALYSIS_AUTH_COOKIE)?.value === accessToken();
  } catch (error) {
    // Unit tests call server actions without a Next.js request context.
    if (process.env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT)
      return true;
    throw error;
  }
}

export async function grantAnalysisAccess() {
  (await cookies()).set(ANALYSIS_AUTH_COOKIE, accessToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}
