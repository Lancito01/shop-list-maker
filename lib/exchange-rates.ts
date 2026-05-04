import type { DisplayCurrency, EntryCurrency } from "@/lib/currency";

type DolarApiRate = {
  compra: number;
  venta: number;
  casa: string;
  nombre: string;
  moneda: string;
  fechaActualizacion: string;
};

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

export type ExchangeRatesSnapshot = {
  arsPerUsd: number;
  eurPerUsd: number;
  fetchedAt: string;
  arsSource: string;
  eurSource: string;
};

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function pickUsdArsRate(rates: DolarApiRate[]): DolarApiRate {
  const official = rates.find((rate) => rate.casa?.toLowerCase() === "oficial");
  if (official) {
    return official;
  }

  const namedOfficial = rates.find((rate) =>
    rate.nombre?.toLowerCase().includes("oficial"),
  );
  if (namedOfficial) {
    return namedOfficial;
  }

  const firstWithQuote = rates.find(
    (rate) => isPositiveNumber(rate.compra) || isPositiveNumber(rate.venta),
  );
  if (firstWithQuote) {
    return firstWithQuote;
  }

  throw new Error("No valid USD/ARS quote found from dolarapi.com.");
}

export async function fetchExchangeRates(): Promise<ExchangeRatesSnapshot> {
  const [arsResponse, eurResponse] = await Promise.all([
    fetch("https://dolarapi.com/v1/dolares", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }),
    fetch("https://api.frankfurter.app/latest?from=EUR&to=USD", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }),
  ]);

  if (!arsResponse.ok) {
    throw new Error(`dolarapi.com returned ${arsResponse.status}.`);
  }
  if (!eurResponse.ok) {
    throw new Error(`Frankfurter returned ${eurResponse.status}.`);
  }

  const arsPayload = (await arsResponse.json()) as DolarApiRate[];
  const eurPayload = (await eurResponse.json()) as FrankfurterResponse;

  if (!Array.isArray(arsPayload)) {
    throw new Error("Invalid dolarapi.com payload.");
  }

  const selectedArsRate = pickUsdArsRate(arsPayload);
  const compra = Number(selectedArsRate.compra);
  const venta = Number(selectedArsRate.venta);
  const arsPerUsd =
    isPositiveNumber(compra) && isPositiveNumber(venta)
      ? (compra + venta) / 2
      : isPositiveNumber(venta)
        ? venta
        : compra;

  const eurToUsd = Number(eurPayload.rates?.USD);
  if (!isPositiveNumber(arsPerUsd) || !isPositiveNumber(eurToUsd)) {
    throw new Error("Invalid exchange rates payload.");
  }

  return {
    arsPerUsd,
    eurPerUsd: 1 / eurToUsd,
    fetchedAt: new Date().toISOString(),
    arsSource: selectedArsRate.nombre || selectedArsRate.casa || "dolarapi.com",
    eurSource: "frankfurter.app (ECB reference rates)",
  };
}

export function convertAmount(
  amount: number,
  from: EntryCurrency,
  to: DisplayCurrency,
  rates: ExchangeRatesSnapshot,
): number {
  if (from === to) {
    return amount;
  }

  if (from === "USD") {
    return to === "ARS" ? amount * rates.arsPerUsd : amount;
  }

  if (from === "ARS") {
    const amountInUsd = amount / rates.arsPerUsd;
    return to === "USD" ? amountInUsd : amount;
  }

  const amountInUsd = amount / rates.eurPerUsd;
  return to === "USD" ? amountInUsd : amountInUsd * rates.arsPerUsd;
}
