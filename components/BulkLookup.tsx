"use client";
import { useRef, useState } from "react";
import { lookupBatchPost, prepareBatch, savePost } from "../app/actions";
import {
  brandLabels,
  type Brand,
  type PostData,
  type SaveResult,
} from "../lib/types";
import { parseBatchInput } from "../lib/urls";
import Icon from "./Icon";
interface Row {
  url: string;
  state: "waiting" | "loading" | "done" | "error";
  data?: PostData;
  save?: SaveResult;
  error?: string;
}
export default function BulkLookup({
  onBusyChange,
}: {
  onBusyChange: (busy: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [inputExpanded, setInputExpanded] = useState(true);
  const [brand, setBrand] = useState<Brand | " ">(" ");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [runBrand, setRunBrand] = useState<Brand | null>(null);
  const lock = useRef(false);
  const parsed = parseBatchInput(text);
  const finished = rows.filter(
    (r) => r.state === "done" || r.state === "error",
  ).length;
  function update(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }
  async function process(url: string, index: number, chosen: Brand) {
    update(index, { state: "loading", error: undefined });
    try {
      const result = await lookupBatchPost(url, chosen);
      update(index, { state: result.error ? "error" : "done", ...result });
    } catch {
      update(index, {
        state: "error",
        error: "조회 실패. 다시 시도해 주세요.",
      });
    }
  }
  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setError("");
    if (brand === " ") {
      setError("협업 브랜드를 선택해 주세요.");
      return;
    }
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    const chosen = brand;
    setRunBrand(chosen);
    try {
      const prepared = await prepareBatch(text, chosen);
      if (prepared.error) {
        setError(prepared.error);
        return;
      }
      setRows(prepared.urls.map((url) => ({ url, state: "waiting" })));
      setInputExpanded(false);
      // Sequential bounded requests avoid burst traffic and Vercel batch timeouts.
      for (let i = 0; i < prepared.urls.length; i++)
        await process(prepared.urls[i], i, chosen);
    } catch {
      setError("대량 조회를 시작하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  async function retry(index: number) {
    if (lock.current || !runBrand) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      const row = rows[index];
      if (row.data && row.save && !row.save.ok) {
        update(index, { state: "loading" });
        let save: SaveResult;
        try {
          save = await savePost(row.data.saveToken || "", runBrand);
        } catch {
          save = {
            ok: false,
            error: "저장하지 못했습니다. 다시 시도해 주세요.",
          };
        }
        update(index, { state: "done", save });
      } else await process(row.url, index, runBrand);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="bulk-layout">
      <section className="panel bulk-input">
        {rows.length > 0 && (
          <div className="bulk-input-summary">
            <span>
              {runBrand ? brandLabels[runBrand] : ""} · {rows.length}개 링크{" "}
              {busy ? `· ${finished}개 처리 완료` : ""}
            </span>
            <button
              type="button"
              className="text-button"
              aria-expanded={inputExpanded}
              aria-controls="bulk-form"
              onClick={() => setInputExpanded(!inputExpanded)}
            >
              {inputExpanded ? "입력 접기" : "입력 펼치기"}
            </button>
          </div>
        )}
        <form id="bulk-form" hidden={!inputExpanded} onSubmit={start}>
          <div className="bulk-form-header">
            <div>
              <h2>게시물 링크 일괄 입력</h2>
              <p className="section-description">
                한 줄에 하나씩, 최대 20개의 링크를 입력해 주세요.
              </p>
            </div>
            <label className="brand-select-label">
              협업 브랜드
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as Brand)}
                disabled={busy}
                required
              >
                <option value=" ">브랜드 선택</option>
                <option value="meitu">메이투</option>
                <option value="beautycam">뷰티캠</option>
              </select>
            </label>
          </div>
          <label htmlFor="bulk-urls" className="sr-only">
            대량 조회 링크
          </label>
          <textarea
            id="bulk-urls"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            placeholder={
              "https://www.instagram.com/reel/xxxxx/\nhttps://www.instagram.com/p/yyyyy/"
            }
            rows={5}
            maxLength={45000}
          />
          <div className="bulk-form-footer">
            <span
              className={parsed.urls.length > 20 ? "save-error" : "field-help"}
            >
              {parsed.urls.length} / 20개
              {parsed.duplicates > 0
                ? ` · 중복 ${parsed.duplicates}개 제외`
                : ""}
            </span>
            <button
              className="submit-button"
              type="submit"
              disabled={busy || parsed.urls.length > 20}
            >
              {busy ? (
                <>
                  <span className="spinner" />
                  {finished} / {rows.length} 처리 중
                </>
              ) : (
                <>
                  일괄 조회
                  <Icon name="arrow" />
                </>
              )}
            </button>
          </div>
          {(error || parsed.urls.length > 20) && (
            <p role="alert" className="save-error">
              {error || parsed.error}
            </p>
          )}
          <p className="field-help">
            선택한 브랜드로 저장합니다. 진행 중에는 이 화면을 유지해 주세요.
          </p>
        </form>
      </section>
      <section className="panel bulk-results">
        <div className="result-heading">
          <h2>
            대량 확인 결과{" "}
            {runBrand && (
              <span className="badge badge-magenta">
                {brandLabels[runBrand]}
              </span>
            )}
          </h2>
          <span className="result-status" role="status">
            {rows.length ? `${finished} / ${rows.length} 완료` : "대기 중"}
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state bulk-empty">
            <span className="empty-icon">
              <Icon name="link" />
            </span>
            <h3>여러 게시물의 시간을 한눈에</h3>
            <p>조회 결과와 저장 상태가 게시물별로 표시됩니다.</p>
          </div>
        ) : (
          <>
            <div className="batch-summary" aria-live="polite">
              조회 성공 {rows.filter((r) => r.state === "done").length} · 조회
              실패 {rows.filter((r) => r.state === "error").length} · 저장 완료{" "}
              {rows.filter((r) => r.save?.ok).length} · 미저장{" "}
              {rows.filter((r) => r.state === "done" && !r.save?.ok).length}
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="대량 조회 결과 표"
            >
              <table className="batch-table">
                <thead>
                  <tr>
                    <th scope="col">계정 이름</th>
                    <th scope="col">계정 ID</th>
                    <th scope="col">유형</th>
                    <th scope="col">수정 여부</th>
                    <th scope="col">
                      최초 포스팅 시간 <small>KST</small>
                    </th>
                    <th scope="col">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.url}>
                      <td>
                        {row.data?.metadata?.accountName || "—"}
                        <a
                          className="row-link"
                          href={
                            row.url.startsWith("https://www.instagram.com/") ||
                            row.url.startsWith("https://instagram.com/")
                              ? row.url
                              : undefined
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          링크 {index + 1} ↗
                        </a>
                      </td>
                      <td>
                        {row.data?.metadata?.accountId
                          ? `@${row.data.metadata.accountId}`
                          : "—"}
                      </td>
                      <td>
                        {row.data
                          ? row.data.postType === "Reel"
                            ? "릴스"
                            : "포스팅"
                          : "—"}
                      </td>
                      <td>
                        {row.data
                          ? row.data.isEdited
                            ? "수정 있음"
                            : "수정 없음"
                          : "—"}
                      </td>
                      <td className="batch-time">
                        {row.data?.uploadTime.replace(" (KST)", "") || "—"}
                      </td>
                      <td>
                        <span
                          className={
                            row.state === "error" || row.save?.ok === false
                              ? "save-error"
                              : "row-status"
                          }
                        >
                          {row.state === "waiting"
                            ? "대기"
                            : row.state === "loading"
                              ? "처리 중..."
                              : row.state === "error"
                                ? "조회 실패"
                                : row.save?.ok
                                  ? "저장 완료"
                                  : "미저장"}
                        </span>
                        {(row.error || row.save?.error) && (
                          <>
                            <p className="row-error">
                              {row.error || row.save?.error}
                            </p>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => retry(index)}
                            >
                              {row.state === "error"
                                ? "다시 조회"
                                : "저장 재시도"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
