import * as cheerio from "cheerio";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { PostData } from "./types";
import { parseInstagramUrl } from "./urls";

dayjs.extend(utc);
dayjs.extend(timezone);
const ORIGINAL_KEYS = [
  "taken_at",
  "taken_at_timestamp",
  "date_taken",
  "original_timestamp",
  "uploadDate",
  "datePublished",
  "created_time",
];
const MODIFIED_KEYS = [
  "dateModified",
  "date_modified",
  "modified_time",
  "modified_at",
  "updated_time",
  "updated_at",
  "edited_at",
  "edit_time",
];
const EDIT_KEYS = [
  "is_caption_edited",
  "caption_is_edited",
  "is_edited",
  "has_been_edited",
  "edited",
];
type JsonObject = Record<string, any>;
function failure(error: string): PostData {
  return {
    postType: null,
    uploadTime: "",
    modifiedTime: null,
    isEdited: false,
    likes: null,
    comments: null,
    views: null,
    caption: null,
    imageUrl: null,
    author: null,
    error,
  };
}
export function parseInstagramDate(value: unknown): dayjs.Dayjs | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    const date = value > 100000000000 ? dayjs(value) : dayjs.unix(value);
    return date.isValid() ? date : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) return parseInstagramDate(Number(text));
  // Instagram epoch values represent UTC instants. ISO strings must specify their offset.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) return null;
  const date = dayjs(text);
  return date.isValid() ? date : null;
}
function formatKst(date: dayjs.Dayjs | null) {
  return date
    ? date.tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss") + " (KST)"
    : "알 수 없음";
}
function profileHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^@?[A-Za-z0-9_.]{1,30}$/.test(value)) return value.replace(/^@/, "");
  try {
    const url = new URL(value);
    if (["instagram.com", "www.instagram.com"].includes(url.hostname))
      return url.pathname.match(/^\/([A-Za-z0-9_.]{1,30})\/?$/)?.[1] || null;
  } catch {}
  return null;
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function count(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return String(value);
  return typeof value === "string" && /^[\d,.]+[km]?$/i.test(value)
    ? value
    : null;
}
function safeImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

// Restrict data to the requested media. Recommendations, comments and profiles may
// contain their own timestamps and must never overwrite this post's upload time.
export function parseInstagramHtml(html: string, url: string): PostData {
  const parsedUrl = parseInstagramUrl(url);
  const $ = cheerio.load(html);
  const media: JsonObject[] = [];
  const schemas: JsonObject[] = [];
  function visit(value: unknown, depth = 0) {
    if (depth > 50 || !value) return;
    if (
      typeof value === "string" &&
      value.length < 2_000_000 &&
      /^[{[]/.test(value.trim())
    ) {
      try {
        visit(JSON.parse(value), depth + 1);
      } catch {}
      return;
    }
    if (typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    const object = value as JsonObject;
    const code = object.shortcode || object.code;
    if (code === parsedUrl.id) {
      media.push(object);
      // Instagram can wrap the actual media in an object carrying the same
      // shortcode (for example, `if_not_gated_logged_out`). Keep walking so
      // the nested object containing `taken_at` is not skipped.
      Object.values(object).forEach((child) => visit(child, depth + 1));
      return;
    }
    if (
      typeof code === "string" &&
      (object.taken_at || object.taken_at_timestamp || object.media_type)
    )
      return;
    if (
      object["@type"] &&
      object["@type"] !== "InstagramPublicProfile" &&
      (object.uploadDate || object.datePublished)
    ) {
      let matching = true;
      const candidateUrl = object.url || object.mainEntityOfPage?.["@id"];
      if (typeof candidateUrl === "string") {
        try {
          matching = parseInstagramUrl(candidateUrl).id === parsedUrl.id;
        } catch {
          matching = false;
        }
      }
      if (matching) schemas.push(object);
    }
    Object.values(object).forEach((child) => visit(child, depth + 1));
  }
  $("script").each((_, el) => {
    const body = $(el).html()?.trim();
    if (body && /^[{[]/.test(body)) {
      try {
        visit(JSON.parse(body));
      } catch {}
    }
  });
  const schema =
    schemas.length === 1
      ? schemas[0]
      : schemas.find((s) => {
          try {
            return parseInstagramUrl(s.url).id === parsedUrl.id;
          } catch {
            return false;
          }
        });
  const records = [...media, ...(schema ? [schema] : [])];
  let upload: dayjs.Dayjs | null = null;
  for (const key of ORIGINAL_KEYS) {
    for (const record of records) {
      const date = parseInstagramDate(record[key]);
      if (date) {
        upload = date;
        break;
      }
    }
    if (upload) break;
  }
  // Only use a single page time as a fallback; multiple times are ambiguous.
  if (!upload) {
    const times = $("article time[datetime]").length
      ? $("article time[datetime]")
      : $("time[datetime]");
    if (times.length === 1)
      upload = parseInstagramDate(times.first().attr("datetime"));
  }
  if (!upload)
    return failure(
      "인스타그램에서 최초 업로드 시간 데이터를 확인할 수 없습니다. 비공개·삭제·접속 제한 여부를 확인하고 잠시 후 다시 시도해 주세요.",
    );
  let modified: dayjs.Dayjs | null = null;
  let edited = false;
  for (const record of records) {
    if (EDIT_KEYS.some((key) => record[key] === true)) edited = true;
    for (const key of MODIFIED_KEYS) {
      const date = parseInstagramDate(record[key]);
      if (date && date.isAfter(upload) && (!modified || date.isAfter(modified)))
        modified = date;
    }
  }
  edited ||= Boolean(modified);
  const main =
    media.find((record) =>
      Boolean(
        record.taken_at ||
          record.taken_at_timestamp ||
          record.media_type ||
          record.like_count ||
          record.caption,
      ),
    ) || media[0];
  const author = Array.isArray(schema?.author)
    ? schema.author[0]
    : schema?.author;
  const owner = main?.owner || main?.user;
  const pageTitle = $("title").text();
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const namedTitle =
    pageTitle.match(/^(.*?)\s*\(@([A-Za-z0-9_.]+)\)/) ||
    ogTitle.match(/^(.*?)\s*\(@([A-Za-z0-9_.]+)\)/);
  const accountId =
    profileHandle(owner?.username) ||
    profileHandle(author?.alternateName) ||
    profileHandle(author?.url) ||
    profileHandle(author?.identifier?.value) ||
    namedTitle?.[2] ||
    null;
  // Keep display name distinct; do not invent one from an @handle.
  const accountName =
    text(owner?.full_name) || text(author?.name) || text(namedTitle?.[1]);
  const ogDescription =
    $('meta[property="og:description"]').attr("content") || "";
  let likes = count(main?.like_count ?? main?.edge_media_preview_like?.count);
  let comments = count(
    main?.comment_count ?? main?.edge_media_to_comment?.count,
  );
  let views = count(main?.play_count ?? main?.video_view_count);
  for (const stat of Array.isArray(schema?.interactionStatistic)
    ? schema.interactionStatistic
    : []) {
    const kind =
      typeof stat.interactionType === "object"
        ? stat.interactionType?.["@type"]
        : stat.interactionType;
    if (typeof kind !== "string") continue;
    if (kind.endsWith("LikeAction"))
      likes = count(stat.userInteractionCount) ?? likes;
    if (kind.endsWith("CommentAction"))
      comments = count(stat.userInteractionCount) ?? comments;
    if (kind.endsWith("WatchAction"))
      views = count(stat.userInteractionCount) ?? views;
  }
  likes ||= ogDescription.match(/([\d,.]+[km]?) likes?/i)?.[1] || null;
  comments ||= ogDescription.match(/([\d,.]+[km]?) comments?/i)?.[1] || null;
  const isReel = parsedUrl.kind === "reel" || main?.product_type === "clips";
  return {
    postType: isReel ? "Reel" : "Post",
    uploadTime: formatKst(upload),
    modifiedTime: edited ? formatKst(modified) : null,
    isEdited: edited,
    likes,
    comments,
    views: isReel ? views || "비공개" : null,
    caption:
      text(main?.caption?.text) ||
      text(main?.edge_media_to_caption?.edges?.[0]?.node?.text) ||
      text(schema?.caption) ||
      text(schema?.headline) ||
      text(schema?.articleBody) ||
      text(ogTitle),
    imageUrl:
      safeImage(main?.display_url) ||
      safeImage(main?.image_versions2?.candidates?.[0]?.url) ||
      safeImage($('meta[property="og:image"]').attr("content")),
    author: accountId,
    metadata: {
      instagramPostId: parsedUrl.id,
      instagramUrl: parsedUrl.url,
      accountName,
      accountId,
      uploadedAt: upload.toISOString(),
      postType: isReel ? "reels" : "post",
      edited,
    },
  };
}
export async function scrapeInstagramPost(url: string): Promise<PostData> {
  let cleanUrl: string;
  try {
    cleanUrl = parseInstagramUrl(url).url;
  } catch (error) {
    return failure((error as Error).message);
  }
  try {
    const response = await fetch(cleanUrl, {
      signal: AbortSignal.timeout(18000),
      redirect: "error",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
    });
    if (!response.ok) {
      if (response.status === 404) return failure("게시물을 찾을 수 없습니다.");
      if (response.status === 429)
        return failure(
          "인스타그램 요청 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요.",
        );
      return failure(
        "인스타그램에 접속할 수 없습니다. 비공개·로그인 필요 여부를 확인해 주세요.",
      );
    }
    return parseInstagramHtml(await response.text(), cleanUrl);
  } catch {
    return failure(
      "게시물 정보를 가져오지 못했습니다. 접속 제한 또는 시간 초과일 수 있으니 잠시 후 다시 시도해 주세요.",
    );
  }
}
