"use client";
import { useEffect, useRef, useState } from "react";
import { getAnalytics } from "../app/actions";
import { summarize } from "../lib/analytics";
import {
  brandLabels,
  typeLabels,
  type AnalyticsResult,
  type Brand,
  type PostType,
} from "../lib/types";
import Icon from "./Icon";
const views = [
  ["all", "전체보기"],
  ["hour", "시간대 기준"],
  ["type", "릴스/포스팅 기준"],
  ["brand", "메이투/뷰티캠 기준"],
] as const;
export default function Analytics() {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | "all">("all");
  const [type, setType] = useState<PostType | "all">("all");
  const [view, setView] = useState("all");
  const request = useRef(0);
  async function refresh() {
    const id = ++request.current;
    setLoading(true);
    try {
      const result = await getAnalytics();
      if (id === request.current) setData(result);
    } catch {
      if (id === request.current)
        setData({
          rows: [],
          total: 0,
          error: "분석 정보를 불러오지 못했습니다. 다시 시도해 주세요.",
        });
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      request.current++;
    };
  }, []);
  const result = summarize(data?.rows || [], brand, type);
  const percentage = (count: number) =>
    result.total ? `${((count / result.total) * 100).toFixed(1)}%` : "0%";
  return (
    <>
      <div className="analysis-tabs" role="group" aria-label="분석 기준">
        {views.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel analysis-filters" aria-label="분석 조건">
        <label>
          협업 브랜드
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value as Brand | "all")}
          >
            <option value="all">전체 브랜드</option>
            <option value="meitu">메이투</option>
            <option value="beautycam">뷰티캠</option>
          </select>
        </label>
        <label>
          게시물 유형
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PostType | "all")}
          >
            <option value="all">전체 유형</option>
            <option value="reels">릴스</option>
            <option value="post">포스팅</option>
          </select>
        </label>
        <button
          className="text-button"
          onClick={() => {
            setBrand("all");
            setType("all");
            setView("all");
          }}
        >
          조건 초기화
        </button>
        <button className="refresh-button" disabled={loading} onClick={refresh}>
          {loading ? "불러오는 중..." : "데이터 새로고침"}
        </button>
      </section>
      {loading ? (
        <div className="panel empty-state" role="status">
          <span className="spinner" />
          <p>저장된 게시물 정보를 불러오고 있어요.</p>
        </div>
      ) : data?.error ? (
        <div className="panel empty-state error-state" role="alert">
          <span className="empty-icon">
            <Icon name="info" />
          </span>
          <h2>분석 데이터를 불러올 수 없어요</h2>
          <p>{data.error}</p>
          <button className="text-button" onClick={refresh}>
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <div className="analysis-summary" aria-live="polite">
            <div className="panel stat-card">
              <span>선택한 조건의 게시물</span>
              <strong>
                {result.total.toLocaleString()}
                <small>개</small>
              </strong>
              <p>전체 저장 데이터 {data?.total.toLocaleString()}개</p>
            </div>
            <div className="panel stat-card">
              <span>가장 많이 업로드한 시간</span>
              <strong className="peak-label">
                {result.peakHours.length
                  ? result.peakHours
                      .map((h) => `${String(h).padStart(2, "0")}시`)
                      .join(", ")
                  : "—"}
              </strong>
              <p>
                {result.max
                  ? `${result.max}개 · 한국 시간 기준`
                  : "아직 집계할 게시물이 없어요"}
              </p>
            </div>
            <div className="panel stat-card">
              <span>분석 조건</span>
              <strong className="filter-label">
                {brand === "all" ? "전체 브랜드" : brandLabels[brand]}
              </strong>
              <p>
                {type === "all" ? "릴스 + 포스팅" : typeLabels[type]} · KST
                (UTC+9)
              </p>
            </div>
          </div>
          {!result.total && (
            <div className="analysis-empty-note" role="status">
              {data?.total
                ? "선택한 조건에 해당하는 게시물이 없습니다. 필터를 변경해 보세요."
                : "아직 저장된 게시물이 없습니다. 조회 화면에서 브랜드를 선택해 게시물을 저장해 주세요."}
            </div>
          )}
          {(view === "all" || view === "hour") && (
            <section className="panel chart-panel">
              <div className="chart-heading">
                <div>
                  <h2>시간대별 업로드</h2>
                  <p>최초 업로드 시각 기준 · 한국 시간 (KST, UTC+9)</p>
                </div>
                <span className="badge badge-magenta">{result.total}개</span>
              </div>
              <div
                className="chart-scroll"
                role="region"
                aria-label="0시부터 23시까지 시간대별 게시물 수"
                tabIndex={0}
              >
                <div className="hour-chart">
                  {result.hours.map(({ hour, count }) => (
                    <div className="hour-column" key={hour}>
                      <span className="bar-number">{count}</span>
                      <div className="bar-track">
                        <div
                          className={`hour-bar ${result.max && count === result.max ? "peak" : ""}`}
                          style={{
                            height: result.max
                              ? `${(count / result.max) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                      <span className="hour-label">
                        {String(hour).padStart(2, "0")}시
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <details className="chart-data">
                <summary>시간대별 수치 보기</summary>
                <div className="hour-data">
                  {result.hours.map(({ hour, count }) => (
                    <span key={hour}>
                      {String(hour).padStart(2, "0")}시{" "}
                      <strong>{count}개</strong>
                    </span>
                  ))}
                </div>
              </details>
            </section>
          )}
          <div className="breakdown-grid">
            {(view === "all" || view === "type") && (
              <section className="panel breakdown">
                <h2>릴스 / 포스팅</h2>
                <p className="section-description">
                  현재 조건의 게시물 수와 비율
                </p>
                {(["reels", "post"] as PostType[]).map((key) => (
                  <div className="distribution" key={key}>
                    <div>
                      <span>{typeLabels[key]}</span>
                      <strong>
                        {result.types[key]}개{" "}
                        <small>{percentage(result.types[key])}</small>
                      </strong>
                    </div>
                    <div className="distribution-track">
                      <span style={{ width: percentage(result.types[key]) }} />
                    </div>
                  </div>
                ))}
              </section>
            )}
            {(view === "all" || view === "brand") && (
              <section className="panel breakdown">
                <h2>메이투 / 뷰티캠</h2>
                <p className="section-description">
                  현재 조건의 게시물 수와 비율
                </p>
                {(["meitu", "beautycam"] as Brand[]).map((key) => (
                  <div className="distribution" key={key}>
                    <div>
                      <span>{brandLabels[key]}</span>
                      <strong>
                        {result.brands[key]}개{" "}
                        <small>{percentage(result.brands[key])}</small>
                      </strong>
                    </div>
                    <div className="distribution-track">
                      <span style={{ width: percentage(result.brands[key]) }} />
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
          <p className="analysis-footnote">
            단건·대량 조회에서 저장한 전체 게시물을 집계합니다. 같은 게시물은 한
            번만 계산하며, 재저장 시 마지막으로 선택한 브랜드로 갱신됩니다.
          </p>
        </>
      )}
    </>
  );
}
