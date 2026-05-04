export const entryCurrencies = ["USD", "EUR", "ARS"] as const;
export type EntryCurrency = (typeof entryCurrencies)[number];

export const displayCurrencies = ["USD", "ARS"] as const;
export type DisplayCurrency = (typeof displayCurrencies)[number];

const formatters: Record<EntryCurrency | DisplayCurrency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  EUR: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  ARS: new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function toNumber(value: string | null | undefined): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(
  value: number,
  currency: EntryCurrency | DisplayCurrency = "USD",
): string {
  return formatters[currency].format(value);
}
