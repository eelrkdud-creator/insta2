import "server-only";
import { neon } from "@neondatabase/serverless";
import type { AnalyticsRow, Brand, PostMetadata } from "./types";
import { ANALYTICS_QUERY, UPSERT_POST, postValues } from "./queries";
export const DB_SETUP_MESSAGE =
  "영구 DB 연결이 아직 설정되지 않았습니다. 관리자에게 DB 연결을 요청해 주세요.";
function connection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(DB_SETUP_MESSAGE);
  return neon(url, { fetchOptions: { signal: AbortSignal.timeout(15000) } });
}
export function databaseError(error: unknown) {
  if (!process.env.DATABASE_URL) return DB_SETUP_MESSAGE;
  if ((error as { code?: string })?.code === "42P01")
    return "DB 테이블 초기화가 필요합니다. 관리자에게 설정을 요청해 주세요.";
  return "DB에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
export async function upsertPost(post: PostMetadata, brand: Brand) {
  await connection().query(UPSERT_POST, postValues(post, brand));
}
export async function readAnalytics(): Promise<AnalyticsRow[]> {
  return (await connection().query(ANALYTICS_QUERY, [])) as AnalyticsRow[];
}
