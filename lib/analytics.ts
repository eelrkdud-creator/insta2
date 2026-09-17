import type { AnalyticsRow, Brand, PostType } from "./types";
export function summarize(
  rows: AnalyticsRow[],
  brand: Brand | "all" = "all",
  type: PostType | "all" = "all",
) {
  const selected = rows.filter(
    (r) =>
      (brand === "all" || r.brand === brand) &&
      (type === "all" || r.post_type === type),
  );
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const brands = { meitu: 0, beautycam: 0 };
  const types = { reels: 0, post: 0 };
  let total = 0;
  for (const row of selected) {
    const count = Number(row.count);
    hours[row.hour].count += count;
    brands[row.brand] += count;
    types[row.post_type] += count;
    total += count;
  }
  const max = Math.max(...hours.map((h) => h.count));
  return {
    hours,
    brands,
    types,
    total,
    max,
    peakHours: max
      ? hours.filter((h) => h.count === max).map((h) => h.hour)
      : [],
  };
}
