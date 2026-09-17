import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { parseBatchInput, parseInstagramUrl } from "../lib/urls";
import { parseInstagramDate, parseInstagramHtml } from "../lib/instagram";
import { ANALYTICS_QUERY, UPSERT_POST, postValues } from "../lib/queries";
import { summarize } from "../lib/analytics";
import { signResult, verifyResult } from "../lib/receipt";
import type { AnalyticsRow, PostMetadata } from "../lib/types";
const post: PostMetadata = {
  instagramPostId: "ExampleA",
  instagramUrl: "https://www.instagram.com/reel/ExampleA/",
  accountName: "테스트 계정",
  accountId: "test_user",
  uploadedAt: "2026-09-16T15:32:08Z",
  postType: "reels",
  edited: false,
};
test("canonical URLs deduplicate tracking, host, trailing slash and p/reel variants by ID", () => {
  assert.equal(
    parseInstagramUrl(" https://instagram.com/p/Ab_c-/?utm_source=x#foo ").id,
    "Ab_c-",
  );
  const result = parseBatchInput(
    "\nhttps://instagram.com/reel/Ab_c-/?igsh=x\nhttps://www.instagram.com/p/Ab_c-/\n\n",
  );
  assert.equal(result.urls.length, 1);
  assert.equal(result.duplicates, 1);
  assert.ok(
    parseBatchInput(
      Array.from(
        { length: 21 },
        (_, i) => `https://instagram.com/p/id${i}/`,
      ).join("\n"),
    ).error,
  );
  assert.equal(
    parseBatchInput(
      Array.from(
        { length: 20 },
        (_, i) => `https://instagram.com/p/id${i}/`,
      ).join("\n"),
    ).error,
    "",
  );
  for (const url of [
    "http://instagram.com/p/x",
    "https://instagram.com.evil.test/p/x",
    "https://instagram.com@evil.test/p/x",
    "https://www.instagram.com/p/x/extra",
    "https://www.instagram.com:999/p/x",
  ])
    assert.throws(() => parseInstagramUrl(url));
});
test("time parsing preserves UTC instants and explicit offsets, rejects host-local ambiguity", () => {
  assert.equal(
    parseInstagramDate("2026-09-17T00:32:08+09:00")?.toISOString(),
    "2026-09-16T15:32:08.000Z",
  );
  assert.equal(
    parseInstagramDate(1789572728)?.toISOString(),
    new Date(1789572728 * 1000).toISOString(),
  );
  assert.equal(parseInstagramDate("2026-09-17T00:32:08"), null);
});
test("requested media timestamp and account are isolated from recommendation and comment metadata", () => {
  const html = `<title>Creator (@test_user) • Instagram</title><script type="application/json">${JSON.stringify(
    {
      items: [
        { code: "Other", taken_at: 1, user: { username: "other" } },
        {
          code: "ExampleA",
          taken_at: 1789572728,
          owner: { full_name: "테스트 계정", username: "test_user" },
          caption: { created_time: 1 },
          comments: [{ taken_at: 1, is_edited: true }],
          like_count: 0,
          is_caption_edited: true,
          edited_at: 1789572828,
        },
      ],
    },
  )}</script>`;
  const result = parseInstagramHtml(html, post.instagramUrl);
  assert.equal(result.error, undefined);
  assert.equal(result.metadata?.accountName, "테스트 계정");
  assert.equal(result.metadata?.accountId, "test_user");
  assert.equal(
    result.metadata?.uploadedAt,
    new Date(1789572728 * 1000).toISOString(),
  );
  assert.equal(result.likes, "0");
  assert.equal(result.isEdited, true);
  assert.ok(result.modifiedTime);
  const onlyOther = parseInstagramHtml(
    '<script>{"code":"Other","taken_at":1789572728}</script>',
    post.instagramUrl,
  );
  assert.ok(onlyOther.error);
  assert.equal(onlyOther.metadata, undefined);
});
test("JSON-LD retains single lookup, offset time, names, metrics and caption", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "VideoObject", url: post.instagramUrl, uploadDate: "2026-09-17T00:32:08+09:00", author: { name: "계정 이름", alternateName: "@user" }, caption: "본문", interactionStatistic: [{ interactionType: { "@type": "LikeAction" }, userInteractionCount: 0 }] })}</script>`;
  const result = parseInstagramHtml(html, post.instagramUrl);
  assert.equal(result.uploadTime, "2026-09-17 00:32:08 (KST)");
  assert.equal(result.metadata?.uploadedAt, "2026-09-16T15:32:08.000Z");
  assert.equal(result.metadata?.accountName, "계정 이름");
  assert.equal(result.author, "user");
  assert.equal(result.caption, "본문");
  assert.equal(result.likes, "0");
  assert.ok(
    parseInstagramHtml("<title>Login</title>", post.instagramUrl).error,
  );
});
test("signed results reject tampered metadata and expire", () => {
  process.env.POST_RESULT_SIGNING_SECRET = "test-only-secret-not-production";
  const token = signResult(post)!;
  assert.deepEqual(verifyResult(token), post);
  const [payload, signature] = token.split(".");
  const changed = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(payload, "base64url").toString()),
      post: { ...post, edited: true },
    }),
  ).toString("base64url");
  assert.throws(() => verifyResult(changed + "." + signature));
  assert.throws(() => verifyResult(token + "extra"));
  const original = Date.now;
  try {
    Date.now = () => original() + 25 * 60 * 60 * 1000;
    assert.throws(() => verifyResult(token));
  } finally {
    Date.now = original;
    delete process.env.POST_RESULT_SIGNING_SECRET;
  }
});
test("PostgreSQL upsert, enum constraints, timezone boundary, all filter combinations", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile("db/001_posts.sql", "utf8"));
    await db.query(UPSERT_POST, postValues(post, "meitu"));
    await db.query(
      UPSERT_POST,
      postValues({ ...post, edited: true }, "beautycam"),
    );
    let stored = (await db.query<any>("SELECT * FROM instagram_posts")).rows;
    assert.equal(stored.length, 1);
    assert.equal(stored[0].brand, "beautycam");
    assert.equal(stored[0].edited, true);
    assert.equal(
      stored[0].uploaded_at.toISOString(),
      "2026-09-16T15:32:08.000Z",
    );
    await db.query(
      UPSERT_POST,
      postValues(
        {
          ...post,
          instagramPostId: "B",
          postType: "post",
          uploadedAt: "2026-09-16T14:59:59Z",
        },
        "meitu",
      ),
    );
    await db.query(
      UPSERT_POST,
      postValues(
        { ...post, instagramPostId: "C", uploadedAt: "2026-09-16T10:00:00Z" },
        "meitu",
      ),
    );
    await db.query(
      UPSERT_POST,
      postValues(
        {
          ...post,
          instagramPostId: "D",
          postType: "post",
          uploadedAt: "2026-09-16T10:00:00Z",
        },
        "beautycam",
      ),
    );
    const rows = (await db.query<AnalyticsRow>(ANALYTICS_QUERY)).rows;
    assert.equal(summarize(rows).hours.length, 24);
    assert.equal(summarize(rows).hours[0].count, 1);
    assert.equal(summarize(rows).hours[23].count, 1);
    assert.equal(summarize(rows).total, 4);
    assert.deepEqual(summarize(rows).peakHours, [19]);
    for (const brand of ["all", "meitu", "beautycam"] as const)
      for (const type of ["all", "reels", "post"] as const) {
        const s = summarize(rows, brand, type);
        assert.equal(
          s.total,
          brand === "all" ? (type === "all" ? 4 : 2) : type === "all" ? 2 : 1,
        );
        assert.equal(
          s.hours.reduce((n, h) => n + h.count, 0),
          s.total,
        );
      }
    assert.equal(summarize([]).max, 0);
    assert.deepEqual(summarize([]).peakHours, []);
    await assert.rejects(() =>
      db.query("UPDATE instagram_posts SET brand = 'unknown'"),
    );
    await assert.rejects(() =>
      db.query("UPDATE instagram_posts SET post_type = 'video'"),
    );
  } finally {
    await db.close();
  }
});
