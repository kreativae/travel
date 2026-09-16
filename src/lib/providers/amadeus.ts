// ---------------------------------------------------------------------------
// ADAPTADOR AMADEUS — dados tarifários reais (Flight Offers Search).
// Ativado automaticamente quando AMADEUS_CLIENT_ID e AMADEUS_CLIENT_SECRET
// estão configuradas. Use AMADEUS_HOSTNAME=production para o ambiente de
// produção (padrão: test, que usa cache de dados reais de produção).
// Estratégia: Flight Cheapest Date Search (grade inteira em poucas chamadas)
// → Flight Offers Search nos melhores pares de datas (preço + bagagem reais).
// ---------------------------------------------------------------------------

import { monthOfISO, type DateCombo } from "@/lib/dates";
import type { OfferDraft, ScanResult } from "./types";

const HOST =
  process.env.AMADEUS_HOSTNAME === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";

export function hasAmadeusKeys(): boolean {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${HOST}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_CLIENT_ID as string,
      client_secret: process.env.AMADEUS_CLIENT_SECRET as string,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OAuth Amadeus falhou (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

async function apiGet(path: string): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${HOST}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Amadeus ${path} → HTTP ${res.status}`);
  return res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseISODuration(iso: string | undefined): number {
  if (!iso) return 720;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  return (m?.[1] ? parseInt(m[1], 10) * 60 : 0) + (m?.[2] ? parseInt(m[2], 10) : 0);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export const amadeusProvider = {
  name: "amadeus" as const,
  async scan(combos: DateCombo[], _at: Date): Promise<ScanResult> {
    const notes: string[] = [
      `Ambiente Amadeus: ${process.env.AMADEUS_HOSTNAME === "production" ? "produção" : "test (cache de dados reais de produção)"}.`,
    ];
    const comboSet = new Set(combos.map((c) => `${c.departDate}|${c.returnDate}`));

    // 1) grade de datas mais baratas para o período completo
    const datesResp = (await apiGet(
      `/v1/shopping/flight-dates?origin=GRU&destination=LON` +
        `&departureDate=2027-04-01,2027-08-15&duration=15,20&nonStop=false&viewBy=DURATION&currency=BRL`
    )) as any;

    const dateRows: Array<{ dep: string; ret: string; price: number }> = [];
    for (const d of datesResp?.data ?? []) {
      const dep = d.departureDate as string;
      const ret = d.returnDate as string;
      if (!comboSet.has(`${dep}|${ret}`)) continue;
      dateRows.push({ dep, ret, price: parseFloat(d.price?.total ?? "0") });
    }
    if (!dateRows.length) {
      throw new Error(
        "Amadeus não retornou datas para GRU–LON na janela (limite de antecedência ou rota fora do cache)"
      );
    }

    // 2) seleção: melhores pares globais + melhores por mês (cobertura)
    dateRows.sort((a, b) => a.price - b.price);
    const chosen = new Map<string, { dep: string; ret: string }>();
    for (const r of dateRows.slice(0, 36)) chosen.set(`${r.dep}|${r.ret}`, r);
    const byMonth = new Map<number, number>();
    for (const r of dateRows) {
      const m = monthOfISO(r.dep);
      const count = byMonth.get(m) ?? 0;
      if (count < 4) {
        chosen.set(`${r.dep}|${r.ret}`, r);
        byMonth.set(m, count + 1);
      }
    }

    // 3) ofertas detalhadas (preço, bagagem, voo) para os pares escolhidos
    const offers: OfferDraft[] = [];
    const coverageByMonth = new Map<number, number>();
    for (const { dep, ret } of chosen.values()) {
      try {
        const resp = (await apiGet(
          `/v2/shopping/flight-offers?originLocationCode=GRU&destinationLocationCode=LON` +
            `&departureDate=${dep}&returnDate=${ret}&adults=1&travelClass=ECONOMY` +
            `&currencyCode=BRL&max=4&nonStop=false`
        )) as any;
        const carriers: Record<string, string> = resp?.dictionaries?.carriers ?? {};
        const days = Math.round(
          (new Date(ret + "T00:00:00Z").getTime() - new Date(dep + "T00:00:00Z").getTime()) / 86400000
        );
        for (const item of resp?.data ?? []) {
          try {
            const itinOut = item.itineraries?.[0];
            const itinBack = item.itineraries?.[1];
            const segOut = itinOut?.segments ?? [];
            const segBack = itinBack?.segments ?? [];
            if (!segOut.length || !segBack.length) continue;
            const code = String(item.validatingAirlineCodes?.[0] ?? segOut[0].carrierCode);
            const checked =
              item.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags;
            const bagIncluded = (checked?.quantity ?? checked?.weight ?? 0) > 0;
            const price = Math.round(parseFloat(item.price?.grandTotal ?? "0"));
            if (!Number.isFinite(price) || price <= 0) continue;
            offers.push({
              routeKey: `GRU|LON|${dep}|${ret}|${code}|${bagIncluded ? "BAG" : "LIGHT"}`,
              origin: "GRU",
              destination: "LON",
              departDate: dep,
              returnDate: ret,
              tripDays: days,
              airline: carriers[code] ?? code,
              airlineCode: code,
              flightOut: `${segOut[0].carrierCode} ${segOut[0].number}`,
              flightBack: `${segBack[0].carrierCode} ${segBack[0].number}`,
              stopsOut: segOut.length - 1,
              stopsBack: segBack.length - 1,
              viaOut: segOut.length > 1 ? segOut[0].arrival?.iataCode ?? null : null,
              viaBack: segBack.length > 1 ? segBack[0].arrival?.iataCode ?? null : null,
              durationOutMin: parseISODuration(itinOut.duration),
              durationBackMin: parseISODuration(itinBack.duration),
              cabin: "ECONOMY",
              baggageIncluded: bagIncluded,
              baggageNote: bagIncluded
                ? `Mala despachada incluída${checked?.quantity ? ` (${checked.quantity}×)` : ""}`
                : "Tarifa light — verificar franquia de bagagem",
              price,
              currency: "BRL",
              deepLink: `https://www.kayak.com.br/flights/GRU-LON/${dep}/${ret}?sort=bestflight_a`,
            });
          } catch {
            /* ignora oferta malformada */
          }
        }
        coverageByMonth.set(monthOfISO(dep), (coverageByMonth.get(monthOfISO(dep)) ?? 0) + 1);
        await sleep(140); // respeita rate limit do ambiente test
      } catch (e) {
        notes.push(`Par ${dep}→${ret}: ${(e as Error).message}`);
      }
    }

    if (!offers.length) throw new Error("Amadeus não retornou ofertas detalhadas");

    return {
      provider: "amadeus",
      offers,
      combosChecked: combos.length,
      coverage: {
        departuresChecked: chosen.size,
        combosWithOffers: coverageByMonth.size
          ? [...coverageByMonth.values()].reduce((a, b) => a + b, 0)
          : 0,
        notes,
      },
      note:
        process.env.AMADEUS_HOSTNAME === "production"
          ? undefined
          : "Dados do ambiente TEST da Amadeus (cache real, disponibilidade limitada).",
    };
  },
};
