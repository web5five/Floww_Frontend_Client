/** Local presentation fixtures only. Not the authoritative backend mandate schema. */
export interface PharmacyQuotePreview {
  id: string;
  merchant: string;
  medicationBaseUnits: string;
  deliveryBaseUnits: string;
  requiresIdentity: boolean;
}
export const pharmacyBudget = "60000000";
export const pharmacyQuotes: readonly PharmacyQuotePreview[] = [
  { id: "demo-quote-a", merchant: "약국 A", medicationBaseUnits: "37000000", deliveryBaseUnits: "6000000", requiresIdentity: false },
  { id: "demo-quote-b", merchant: "약국 B", medicationBaseUnits: "39000000", deliveryBaseUnits: "8000000", requiresIdentity: true },
  { id: "demo-quote-c", merchant: "약국 C", medicationBaseUnits: "54000000", deliveryBaseUnits: "9000000", requiresIdentity: false },
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
