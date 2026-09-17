import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lookupBatchPost,
  prepareBatch,
  scrapeInstagramPost,
  savePost,
  getAnalytics,
} from "../app/actions";

test("batch validation, partial fetch failure and DB failure preserve successful lookup data", async () => {
  const originalFetch = globalThis.fetch;
  const dbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("Missing")) return new Response("", { status: 404 });
      return new Response(
        `<script type="application/ld+json">${JSON.stringify({ "@type": "SocialMediaPosting", url, uploadDate: "2026-09-16T10:32:00Z", author: { name: "이름", alternateName: "@creator" } })}</script>`,
        { status: 200 },
      );
    };
    const prepared = await prepareBatch(
      "https://instagram.com/p/Good/\nhttps://instagram.com/p/Missing/\nhttps://instagram.com/p/Good/?igsh=xxx",
      "beautycam",
    );
    assert.equal(prepared.urls.length, 2);
    assert.ok(
      (await prepareBatch("https://instagram.com/p/Good/", "invalid")).error,
    );
    assert.ok(
      (
        await prepareBatch(
          Array.from(
            { length: 21 },
            (_, i) => `https://instagram.com/p/P${i}`,
          ).join("\n"),
          "meitu",
        )
      ).error,
    );
    const rows = [];
    for (const url of prepared.urls)
      rows.push(await lookupBatchPost(url, "beautycam"));
    assert.equal(rows[0].data?.uploadTime, "2026-09-16 19:32:00 (KST)");
    assert.equal(rows[0].save?.ok, false);
    assert.match(rows[0].save?.error || "", /DB 연결/);
    assert.match(rows[1].error || "", /찾을 수 없습니다/);
    const single = await scrapeInstagramPost("https://instagram.com/p/Good/");
    assert.equal(single.error, undefined);
    assert.equal(single.metadata?.accountId, "creator");
    assert.equal((await savePost("untrusted", "meitu")).ok, false);
    const analysis = await getAnalytics();
    assert.ok(analysis.error);
    assert.equal(analysis.total, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (dbUrl) process.env.DATABASE_URL = dbUrl;
  }
});
