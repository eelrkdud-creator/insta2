import Link from "next/link";
import Icon from "./Icon";
export default function Shell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "lookup" | "analysis";
}) {
  return (
    <div className="workspace">
      <a href="#main" className="skip-link">
        본문으로 이동
      </a>
      <aside className="workspace-rail" aria-label="서비스 메뉴">
        <Link
          className={`rail-item ${active === "lookup" ? "rail-active" : ""}`}
          href="/"
          aria-label="게시물 조회"
          aria-current={active === "lookup" ? "page" : undefined}
        >
          <Icon name="clock" />
          <span>조회</span>
        </Link>
        <Link
          className={`rail-item ${active === "analysis" ? "rail-active" : ""}`}
          href="/analysis"
          aria-label="분석"
          aria-current={active === "analysis" ? "page" : undefined}
        >
          <Icon name="chart" />
          <span>분석</span>
        </Link>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <Link href="/" className="wordmark">
            메이투&amp;뷰티캠 코리아 협업 게시물 조회
          </Link>
          <span className="timezone">
            <span className="status-dot" />
            한국 표준시 · KST
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
