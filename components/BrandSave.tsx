"use client";
import { useState } from "react";
import { savePost } from "../app/actions";
import { brandLabels, type Brand, type SaveResult } from "../lib/types";
export default function BrandSave({ token }: { token?: string }) {
  const [selected, setSelected] = useState<Brand | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  async function save(brand: Brand) {
    setSelected(brand);
    setBusy(true);
    setResult(null);
    try {
      setResult(await savePost(token || "", brand));
    } catch {
      setResult({
        ok: false,
        error: "저장하지 못했습니다. 다시 시도해 주세요.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="brand-save">
      <div className="brand-save-row">
        <span className="field-title">협업 브랜드</span>
        <div
          className="brand-options"
          role="group"
          aria-label="협업 브랜드 선택"
        >
          {(["meitu", "beautycam"] as Brand[]).map((brand) => (
            <button
              type="button"
              key={brand}
              aria-pressed={selected === brand}
              disabled={busy}
              onClick={() => save(brand)}
            >
              {brandLabels[brand]}
            </button>
          ))}
        </div>
      </div>
      <p
        className={`save-message ${result && !result.ok ? "save-error" : ""}`}
        role="status"
      >
        {busy
          ? "저장 중..."
          : result?.ok
            ? `${selected ? brandLabels[selected] : ""} 협업으로 저장했습니다.`
            : result?.error || "브랜드를 선택하면 분석 데이터에 저장됩니다."}
      </p>
      {result && !result.ok && selected && (
        <button className="text-button" onClick={() => save(selected)}>
          저장 다시 시도
        </button>
      )}
    </div>
  );
}
