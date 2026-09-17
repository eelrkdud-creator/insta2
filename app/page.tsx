"use client";

import { useState, type FormEvent } from "react";
import { scrapeInstagramPost, type PostData } from "./actions";
import Icon from "../components/Icon";
import Shell from "../components/Shell";
import BrandSave from "../components/BrandSave";
import BulkLookup from "../components/BulkLookup";

export default function Home() {
  const [bulk, setBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PostData | null>(null);
  const [requestError, setRequestError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const error = requestError || data?.error;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setData(null);
    setRequestError("");
    setImageFailed(false);
    try {
      setData(await scrapeInstagramPost(url.trim()));
    } catch {
      setRequestError("정보를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell active="lookup">
      <main id="main" className="main-content">
        <div className="page-heading">
          <span className="eyebrow">INSTAGRAM POST VIEWER</span>
          <h1>게시물 업로드 시간 확인</h1>
        </div>
        <div className="mode-row">
          <label className="mode-switch">
            <input
              type="checkbox"
              role="switch"
              checked={bulk}
              disabled={loading || bulkBusy}
              onChange={(e) => setBulk(e.target.checked)}
            />
            <span className="switch-track" aria-hidden="true" />
            <span>대량 확인</span>
            <span className="mode-state">{bulk ? "ON" : "OFF"}</span>
          </label>
          <span className="mode-help">
            {bulk
              ? "브랜드를 선택하고 최대 20개를 한 번에 확인하세요."
              : "게시물 링크 하나를 입력해 조회하세요."}
          </span>
        </div>
        {bulk ? (
          <BulkLookup onBusyChange={setBulkBusy} />
        ) : (
          <div className="content-grid">
            <div className="input-column">
              <section
                className="panel input-panel"
                aria-labelledby="input-title"
              >
                <div className="section-heading">
                  <span className="section-icon">
                    <Icon name="link" />
                  </span>
                  <h2 id="input-title">게시물 링크</h2>
                </div>
                <p className="section-description">
                  확인하고 싶은 게시물이나 릴스의 링크를 붙여넣어 주세요.
                </p>
                <form onSubmit={handleSubmit}>
                  <label htmlFor="url">인스타그램 URL</label>
                  <input
                    id="url"
                    name="url"
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.instagram.com/p/..."
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby="url-help"
                  />
                  <button
                    className="submit-button"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner" />
                        조회 중...
                      </>
                    ) : (
                      <>
                        정보 조회
                        <Icon name="arrow" />
                      </>
                    )}
                  </button>
                  <p id="url-help" className="field-help">
                    <Icon name="info" />
                    공개 게시물만 조회할 수 있어요.
                  </p>
                </form>
              </section>
              <section className="usage-notes" aria-labelledby="notes-title">
                <h2 id="notes-title">조회 전 확인해 주세요</h2>
                <ul>
                  <li>
                    비공개·삭제된 게시물이나 로그인이 필요한 게시물은 조회가
                    어려울 수 있어요.
                  </li>
                  <li>
                    인스타그램 접속 제한으로 조회가 일시적으로 실패할 수 있어요.
                  </li>
                  <li>방금 업로드한 게시물은 잠시 후 다시 조회해 주세요.</li>
                </ul>
              </section>
            </div>
            <section
              className="panel result-panel"
              aria-labelledby="result-title"
              aria-busy={loading}
            >
              <div className="result-heading">
                <h2 id="result-title">조회 결과</h2>
                <span
                  className={`result-status ${data && !error ? "is-complete" : ""}`}
                >
                  {loading
                    ? "조회 중"
                    : error
                      ? "조회 실패"
                      : data
                        ? "조회 완료"
                        : "대기 중"}
                </span>
              </div>
              <div role="status" className="sr-only">
                {loading
                  ? "게시물 정보를 조회하고 있습니다."
                  : data && !error
                    ? "게시물 정보 조회가 완료되었습니다."
                    : ""}
              </div>
              {loading ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <span className="spinner" />
                  </span>
                  <h3>게시물 정보를 확인하고 있어요</h3>
                  <p>
                    업로드 시간과 게시물 정보를 불러오는 중입니다.
                    <br />
                    잠시만 기다려 주세요.
                  </p>
                  <div className="loading-bars" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              ) : error ? (
                <div className="empty-state error-state" role="alert">
                  <span className="empty-icon">
                    <Icon name="info" />
                  </span>
                  <h3>게시물을 조회하지 못했어요</h3>
                  <p>{error}</p>
                  <span className="state-hint">
                    링크를 확인한 후 다시 조회해 주세요.
                  </span>
                </div>
              ) : data ? (
                <div className="result-content">
                  <BrandSave
                    key={
                      data.saveToken ||
                      data.metadata?.instagramPostId ||
                      data.uploadTime
                    }
                    token={data.saveToken}
                  />
                  <div className="time-block">
                    <div className="time-heading">
                      <p className="time-label">
                        <Icon name="clock" />
                        최초 업로드 시간 (KST)
                      </p>
                      <div className="post-badges">
                        <span className="badge badge-magenta">
                          {data.postType === "Reel" ? "릴스" : "게시물"}
                        </span>
                        <span
                          className={`badge ${data.isEdited ? "badge-edited" : "badge-success"}`}
                        >
                          {!data.isEdited && <Icon name="check" />}
                          {data.isEdited ? "수정됨" : "수정 없음"}
                        </span>
                      </div>
                    </div>
                    <p className="upload-time">{data.uploadTime}</p>
                  </div>
                  {data.isEdited && (
                    <div className="modified-time">
                      <span>수정 시간 (KST)</span>
                      <strong>{data.modifiedTime || "알 수 없음"}</strong>
                    </div>
                  )}
                  {data.imageUrl && !imageFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="post-image"
                      src={data.imageUrl}
                      alt="조회한 인스타그램 게시물"
                      onError={() => setImageFailed(true)}
                    />
                  ) : (
                    <div className="image-placeholder">
                      <Icon name="image" />
                      <span>이미지 미리보기를 제공하지 않는 게시물이에요.</span>
                    </div>
                  )}
                  <dl className="metrics">
                    <div>
                      <dt>
                        <Icon name="heart" />
                        좋아요
                      </dt>
                      <dd>{data.likes ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="comment" />
                        댓글
                      </dt>
                      <dd>{data.comments ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon name="play" />
                        조회수
                      </dt>
                      <dd>
                        {data.postType === "Reel" ? (data.views ?? "—") : "—"}
                      </dd>
                    </div>
                  </dl>
                  {data.caption && (
                    <div className="caption">
                      <h3>캡션</h3>
                      <p>{data.caption}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Icon name="clock" />
                  </span>
                  <h3>게시물의 시간을 확인해 보세요</h3>
                  <p>
                    입력란에 인스타그램 링크를 넣으면
                    <br />
                    조회한 게시물 정보가 이곳에 표시됩니다.
                  </p>
                  <div className="empty-features">
                    <span>업로드 시간</span>
                    <span>게시물 정보</span>
                    <span>반응 수치</span>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
        <footer className="footer">
          <p>제작 : 李佳鍈 Kaylen</p>
          <div>
            <a href="mailto:gayeonglee@iwink.tw">gayeonglee@iwink.tw</a>
            <span aria-hidden="true">·</span>
            <a href="mailto:gayeonglee.work@gmail.com">
              gayeonglee.work@gmail.com
            </a>
          </div>
        </footer>
      </main>
    </Shell>
  );
}
