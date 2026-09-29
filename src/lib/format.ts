export const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
export const percent = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
