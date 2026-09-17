export type Brand = "meitu" | "beautycam";
export type PostType = "reels" | "post";
export interface PostMetadata {
  instagramPostId: string;
  instagramUrl: string;
  accountName: string | null;
  accountId: string | null;
  uploadedAt: string;
  postType: PostType;
  edited: boolean;
}
export interface PostData {
  postType: "Post" | "Reel" | null;
  uploadTime: string;
  modifiedTime: string | null;
  isEdited: boolean;
  likes: string | null;
  comments: string | null;
  views: string | null;
  caption: string | null;
  imageUrl: string | null;
  author: string | null;
  metadata?: PostMetadata;
  saveToken?: string;
  error?: string;
}
export type SaveResult = { ok: boolean; error?: string };
export type AnalyticsRow = {
  hour: number;
  brand: Brand;
  post_type: PostType;
  count: number;
};
export type AnalyticsResult = {
  rows: AnalyticsRow[];
  total: number;
  error?: string;
};
export const brandLabels: Record<Brand, string> = {
  meitu: "메이투",
  beautycam: "뷰티캠",
};
export const typeLabels: Record<PostType, string> = {
  reels: "릴스",
  post: "포스팅",
};
export function isBrand(value: unknown): value is Brand {
  return value === "meitu" || value === "beautycam";
}
