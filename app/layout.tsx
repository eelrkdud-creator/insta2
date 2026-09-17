import "./globals.css";
import type { Metadata } from "next";

export const maxDuration = 60;

export const metadata: Metadata = {
  title: "메이투&뷰티캠 코리아 협업 게시물 조회",
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
