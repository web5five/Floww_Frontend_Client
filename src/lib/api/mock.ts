import type { DashboardData, DemoScenario, ProductCandidate, PurchaseRequest } from "./types";

export const defaultCandidate: ProductCandidate = {
  title: "Nike 러닝화",
  brand: "Nike",
  category: "러닝화",
  color: "검정",
  size_eu: 45,
  merchant: "Nike 데모 스토어",
  price: 105,
  estimated_fee: 3,
};
export const mockDashboard: DashboardData = {
  source: "mock",
  candidate: defaultCandidate,
  connection: "not-connected",
};
export function defaultRequest(now: number): PurchaseRequest {
  return {
    intent: "Nike 검정 러닝화 구매",
    requirements: { brand: "Nike", category: "러닝화", color: "검정", size_eu: 45 },
    budget: { currency: "USDC", maximum: 120 },
    deadline: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    allowed_merchants: ["Nike 데모 스토어"],
  };
}
export function scenarioCandidate(scenario: DemoScenario): ProductCandidate {
  return {
    ...defaultCandidate,
    ...(scenario === "over-budget" ? { price: 119, estimated_fee: 3 } : {}),
    ...(scenario === "unapproved-merchant" ? { merchant: "미승인 데모 마켓" } : {}),
  };
}
