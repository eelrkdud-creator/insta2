import type { Brand, PostMetadata } from "./types";
export const UPSERT_POST = `INSERT INTO instagram_posts
(instagram_post_id, instagram_url, account_name, account_id, uploaded_at, post_type, edited, brand)
VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8)
ON CONFLICT (instagram_post_id) DO UPDATE SET
instagram_url = EXCLUDED.instagram_url,
account_name = COALESCE(EXCLUDED.account_name, instagram_posts.account_name),
account_id = COALESCE(EXCLUDED.account_id, instagram_posts.account_id),
uploaded_at = EXCLUDED.uploaded_at,
post_type = EXCLUDED.post_type,
edited = EXCLUDED.edited,
brand = EXCLUDED.brand,
updated_at = now()
RETURNING instagram_post_id`;
export function postValues(post: PostMetadata, brand: Brand) {
  return [
    post.instagramPostId,
    post.instagramUrl,
    post.accountName,
    post.accountId,
    post.uploadedAt,
    post.postType,
    post.edited,
    brand,
  ];
}
// Aggregate the entire table before returning at most 24 × 2 × 2 rows.
export const ANALYTICS_QUERY = `SELECT EXTRACT(HOUR FROM uploaded_at AT TIME ZONE 'Asia/Seoul')::int AS hour,
brand, post_type, COUNT(*)::int AS count FROM instagram_posts
GROUP BY hour, brand, post_type ORDER BY hour, brand, post_type`;
