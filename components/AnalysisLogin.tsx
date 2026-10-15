"use client";

import { useActionState } from "react";
import { unlockAnalysis } from "../app/analysis/actions";

export default function AnalysisLogin() {
  const [state, action, pending] = useActionState(unlockAnalysis, {});

  return (
    <section className="panel analysis-lock" aria-labelledby="analysis-lock-title">
      <div className="analysis-lock-mark" aria-hidden="true">🔒</div>
      <div className="analysis-lock-copy">
        <span className="eyebrow">PRIVATE INSIGHTS</span>
        <h2 id="analysis-lock-title">분석창 비밀번호 입력</h2>
        <p>협업 게시물 분석 데이터는 비밀번호 확인 후 볼 수 있습니다.</p>
      </div>
      <form action={action} className="analysis-lock-form">
        <label htmlFor="analysis-password">비밀번호</label>
        <div className="analysis-lock-input-row">
          <input
            id="analysis-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            aria-describedby={state.error ? "analysis-password-error" : undefined}
          />
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? "확인 중…" : "분석창 열기"}
          </button>
        </div>
        {state.error ? (
          <p id="analysis-password-error" className="analysis-lock-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
