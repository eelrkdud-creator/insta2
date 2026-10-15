"use server";

import { redirect } from "next/navigation";
import {
  grantAnalysisAccess,
  matchesAnalysisPassword,
} from "../../lib/analysis-auth";

export type AnalysisLoginState = { error?: string };

export async function unlockAnalysis(
  _state: AnalysisLoginState,
  formData: FormData,
): Promise<AnalysisLoginState> {
  if (!matchesAnalysisPassword(formData.get("password"))) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }
  await grantAnalysisAccess();
  redirect("/analysis");
}
