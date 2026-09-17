import Shell from "../../components/Shell";
import Analytics from "../../components/Analytics";
export default function AnalysisPage() {
  return (
    <Shell active="analysis">
      <main id="main" className="main-content">
        <div className="page-heading">
          <span className="eyebrow">COLLABORATION INSIGHTS</span>
          <h1>협업 게시물 분석</h1>
          <p>브랜드와 게시물 유형을 조합해 업로드 패턴을 확인하세요.</p>
        </div>
        <Analytics />
      </main>
    </Shell>
  );
}
