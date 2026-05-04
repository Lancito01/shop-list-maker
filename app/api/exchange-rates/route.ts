import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { fetchExchangeRates, type ExchangeRatesSnapshot } from "@/lib/exchange-rates";

type CachedRates = {
  expiresAt: number;
  data: ExchangeRatesSnapshot;
};

let cachedRates: CachedRates | null = null;
const cacheTtlMs = 5 * 60 * 1000;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  const now = Date.now();
  if (cachedRates && cachedRates.expiresAt > now) {
    return NextResponse.json(cachedRates.data);
  }

  try {
    const data = await fetchExchangeRates();
    cachedRates = { data, expiresAt: now + cacheTtlMs };
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch exchange rates", error);
    return NextResponse.json(
      { error: "Unable to fetch exchange rates." },
      { status: 503 },
    );
  }
}
