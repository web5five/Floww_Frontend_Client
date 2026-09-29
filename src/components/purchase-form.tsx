"use client";
import { useState, type FormEvent } from "react";
import type { PurchaseRequest } from "@/lib/api/types";
import { validateRequest } from "@/lib/purchase-demo";

export function PurchaseForm({ request, locked, onSubmit, onDraft }: { request?: PurchaseRequest; locked: boolean; onSubmit?: (request: PurchaseRequest) => void; onDraft?: (content: string) => void }) {
  const [error, setError] = useState("");
  const localDate = (iso: string) => {
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locked) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const deadline = new Date(text("deadline"));
    if (onDraft) {
      onDraft(`목적: ${text("intent")}\n브랜드: ${text("brand")}\n카테고리: ${text("category")}\n색상: ${text("color")}\nEU 사이즈: ${text("size_eu")}\n최대 예산: ${text("maximum")} USDC\n기한: ${Number.isFinite(deadline.getTime()) ? deadline.toISOString() : "미정"}\n허용 판매처: ${text("allowed_merchants")}\n수수료 포함 여부와 미확정 조건은 질문해 주세요.`);
      return;
    }
    const value: PurchaseRequest = {
      intent: text("intent"),
      requirements: { brand: text("brand"), category: text("category"), color: text("color"), size_eu: Number(text("size_eu")) },
      budget: { currency: "USDC", maximum: Number(text("maximum")) },
      deadline: Number.isFinite(deadline.getTime()) ? deadline.toISOString() : "",
      allowed_merchants: [...new Set(text("allowed_merchants").split(/[,\n]/).map(v => v.trim()).filter(Boolean))],
    };
    const problem = validateRequest(value, Date.now());
    setError(problem ?? "");
    if (!problem) onSubmit?.(value);
  };
  return <form onSubmit={submit} className="purchase-form">
    <p className="form-note">{onDraft ? "서버 프록시를 통해 AI 초안을 요청합니다. 매 요청마다 모델 비용이 발생할 수 있으며 자동 재시도하지 않습니다." : "입력값은 브라우저 안에서만 사용합니다. 후보는 Nike 검정 러닝화 EU 45 한 개로 고정된 데모이며, 조건이 다르면 차단됩니다."}</p>
    <fieldset disabled={locked}>
      <legend className="sr-only">구매 조건 입력</legend>
      <div className="form-grid">
        <label className="field wide">상품 또는 구매 목적<input name="intent" required maxLength={160} defaultValue={request?.intent ?? "Nike 검정 러닝화 구매"} /></label>
        <label className="field">브랜드<input name="brand" required maxLength={80} defaultValue={request?.requirements.brand ?? "Nike"} /></label>
        <label className="field">카테고리<input name="category" required maxLength={80} defaultValue={request?.requirements.category ?? "러닝화"} /></label>
        <label className="field">색상<input name="color" required maxLength={80} defaultValue={request?.requirements.color ?? "검정"} /></label>
        <label className="field">사이즈 (EU)<input name="size_eu" type="number" min="1" max="60" step="0.5" required defaultValue={request?.requirements.size_eu ?? 45} /></label>
        <label className="field">결제 자산<select name="currency" defaultValue="USDC"><option value="USDC">USDC</option></select></label>
        <label className="field">최대 예산 (USDC)<input name="maximum" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={request?.budget.maximum ?? 120} /></label>
        <label className="field">구매 기한 (현재 기기 시간)<input name="deadline" type="datetime-local" required defaultValue={request ? localDate(request.deadline) : ""} /></label>
        <div className="field wide"><label htmlFor={onDraft ? "api-merchants" : "allowed-merchants"}>허용 판매처</label><input id={onDraft ? "api-merchants" : "allowed-merchants"} name="allowed_merchants" required maxLength={500} defaultValue={request?.allowed_merchants.join(", ") ?? (onDraft ? "" : "Nike 데모 스토어")} /><small>여러 판매처는 쉼표로 구분합니다. {onDraft ? "입력 조건은 아직 승인되지 않았습니다." : "모두 데모 판매처 이름이며 실제 연결되지 않았습니다."}</small></div>
      </div>
      <button type="submit" className="button primary">{onDraft ? "AI 초안 요청 (비용 발생 가능)" : "구매 조건 생성 및 데모 판단"}</button>
    </fieldset>
    {locked && <p className="form-note">{onDraft ? "요청 처리 중입니다. 중복 요청은 차단됩니다." : "승인 대기 중에는 조건을 바꿀 수 없습니다. 먼저 승인·거절·전체 중단 중 하나를 선택하세요."}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </form>;
}
