import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "insta2 | 게시물 업로드 시간 확인",
  description:
    "인스타그램 게시물과 릴스의 업로드 시간 및 게시물 정보를 확인하세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
