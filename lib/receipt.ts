import { createHmac, timingSafeEqual } from "node:crypto";
import type { PostMetadata } from "./types";
// Never accept editable client metadata as a source of truth for the permanent DB.
function secret() {
  return process.env.POST_RESULT_SIGNING_SECRET || process.env.DATABASE_URL;
}
export function signResult(post: PostMetadata) {
  const key = secret();
  if (!key) return undefined;
  const payload = Buffer.from(
    JSON.stringify({ post, expires: Date.now() + 24 * 60 * 60 * 1000 }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", key).update(payload).digest("base64url")
  );
}
export function verifyResult(token: string): PostMetadata {
  const key = secret();
  if (!key) throw new Error("DB 연결 설정이 필요합니다.");
  if (typeof token !== "string" || token.length > 10000)
    throw new Error("다시 조회한 후 저장해 주세요.");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra)
    throw new Error("다시 조회한 후 저장해 주세요.");
  const expected = createHmac("sha256", key).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("조회 정보가 변경되었습니다. 다시 조회해 주세요.");
  const value = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (!Number.isFinite(value.expires) || Date.now() > value.expires)
    throw new Error("조회 정보가 만료되었습니다. 다시 조회해 주세요.");
  return value.post;
}
