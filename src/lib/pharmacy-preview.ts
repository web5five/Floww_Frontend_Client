/** Local presentation fixtures only. Not the authoritative backend mandate schema. */
export interface PharmacyQuotePreview {
  id: string;
  merchant: string;
  medicationBaseUnits: string;
  deliveryBaseUnits: string;
  requiresIdentity: boolean;
  recipientAllowed: boolean;
}
export const pharmacyBudget = "60000000";
export const pharmacyQuotes: readonly PharmacyQuotePreview[] = [
  { id: "demo-quote-a", merchant: "약국 A", medicationBaseUnits: "20500000", deliveryBaseUnits: "3000000", requiresIdentity: false, recipientAllowed: true },
  { id: "demo-quote-b", merchant: "약국 B", medicationBaseUnits: "52000000", deliveryBaseUnits: "12000000", requiresIdentity: true, recipientAllowed: true },
  { id: "demo-quote-c", merchant: "약국 C", medicationBaseUnits: "17000000", deliveryBaseUnits: "2000000", requiresIdentity: false, recipientAllowed: false },
];
function units(value: string) {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error("Invalid base-unit amount");
  return BigInt(value);
}
export const quoteSubtotal = (quote: PharmacyQuotePreview) => (units(quote.medicationBaseUnits) + units(quote.deliveryBaseUnits)).toString();
export function formatFusdc(value: string) {
  const amount = units(value), scale = BigInt(1000000), fraction = (amount % scale).toString().padStart(6, "0");
  return `${amount / scale}.${fraction.replace(/0+$/, "").padEnd(2, "0")} fUSDC`;
}
export const exceedsPreviewBudget = (quote: PharmacyQuotePreview) => units(quoteSubtotal(quote)) > units(pharmacyBudget);
export const previewBlockReason = (quote: PharmacyQuotePreview) => !quote.recipientAllowed ? "BLOCKED · RECIPIENT_NOT_ALLOWED · 미승인 수신자" : exceedsPreviewBudget(quote) ? "BLOCKED · BUDGET_EXCEEDED · 상품·배송 소계만으로 예산 초과" : "미판정 · 데모 조건 확인 필요";
