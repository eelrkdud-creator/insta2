"use server";

import { scrapeInstagramPost as lookup } from "../lib/instagram";
import { signResult, verifyResult } from "../lib/receipt";
import {
  databaseError,
  DB_SETUP_MESSAGE,
  readAnalytics,
  upsertPost,
} from "../lib/db";
import {
  isBrand,
  type AnalyticsResult,
  type PostData,
  type SaveResult,
} from "../lib/types";
import { parseBatchInput, parseInstagramUrl } from "../lib/urls";
export type { PostData } from "../lib/types";

export async function scrapeInstagramPost(url: string): Promise<PostData> {
  const result = await lookup(url);
  if (result.metadata && !result.error)
    result.saveToken = signResult(result.metadata);
  return result;
}
export async function savePost(
  token: string,
  brand: string,
): Promise<SaveResult> {
  if (!isBrand(brand))
    return { ok: false, error: "협업 브랜드를 선택해 주세요." };
  if (!process.env.DATABASE_URL) return { ok: false, error: DB_SETUP_MESSAGE };
  let post;
  try {
    post = verifyResult(token);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  try {
    await upsertPost(post, brand);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: databaseError(error) };
  }
}
export async function prepareBatch(text: string, brand: string) {
  if (!isBrand(brand))
    return { urls: [], error: "협업 브랜드를 선택해 주세요." };
  if (typeof text !== "string" || text.length > 45000)
    return {
      urls: [],
      error:
        "입력한 링크가 너무 깁니다. 최대 20개의 게시물 링크를 입력해 주세요.",
    };
  const result = parseBatchInput(text);
  return { urls: result.error ? [] : result.urls, error: result.error };
}
// Each row is a separate bounded request so one timeout cannot discard the batch.
export async function lookupBatchPost(
  url: string,
  brand: string,
): Promise<{ data?: PostData; save?: SaveResult; error?: string }> {
  if (!isBrand(brand)) return { error: "협업 브랜드를 선택해 주세요." };
  try {
    parseInstagramUrl(url);
  } catch (error) {
    return { error: (error as Error).message };
  }
  try {
    const data = await scrapeInstagramPost(url);
    if (data.error || !data.metadata)
      return { error: data.error || "게시물 정보를 찾을 수 없습니다." };
    const save = await savePost(data.saveToken || "", brand);
    return { data, save };
  } catch {
    return { error: "조회에 실패했습니다. 이 게시물만 다시 시도해 주세요." };
  }
}
export async function getAnalytics(): Promise<AnalyticsResult> {
  try {
    const rows = await readAnalytics();
    return {
      rows,
      total: rows.reduce((sum, row) => sum + Number(row.count), 0),
    };
  } catch (error) {
    return { rows: [], total: 0, error: databaseError(error) };
  }
}
