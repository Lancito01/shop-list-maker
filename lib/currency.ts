export const entryCurrencies = ["USD", "EUR", "ARS"] as const;
export type EntryCurrency = (typeof entryCurrencies)[number];

export const displayCurrencies = ["USD", "ARS"] as const;
export type DisplayCurrency = (typeof displayCurrencies)[number];

const numberFormatters: Record<EntryCurrency | DisplayCurrency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  EUR: new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  ARS: new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function toNumber(value: string | null | undefined): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Returns `{ number, currency }` parts so callers can style the currency code separately. */
export function formatCurrencyParts(
  value: number,
  currency: EntryCurrency | DisplayCurrency = "USD",
): { number: string; currency: string } {
  return { number: numberFormatters[currency].format(value), currency };
}

/** Returns a plain string like `1,234.00$USD`. */
export function formatCurrency(
  value: number,
  currency: EntryCurrency | DisplayCurrency = "USD",
): string {
  const parts = formatCurrencyParts(value, currency);
  return `${parts.number}$${parts.currency}`;
}
