// ---------------------------------------------------------------------------
// ADAPTADOR TRAVELPAYOUTS — TARIFAS REAIS (cache Aviasales, últimas 48h)
// Ativado com TRAVELPAYOUTS_TOKEN (cadastro gratuito e self-service em
// travelpayouts.com — 300 req/min, sem cartão). Retorna preços REAIS
// encontrados por usuários recentemente — não cotações reserváveis.
// A franquia de bagagem não vem na API: classificamos pela política típica
// da companhia (rotulado como tal) e geramos a variante "+ mala 23 kg"
// somando a taxa típica (também rotulada como estimativa).
// ---------------------------------------------------------------------------

import type { DateCombo } from "@/lib/dates";
import type { OfferDraft, ScanResult } from "./types";

const ENDPOINT = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";

export function hasTravelpayoutsToken(): boolean {
  return Boolean(process.env.TRAVELPAYOUTS_TOKEN);
}

type BagPolicy = { kind: "included" } | { kind: "light"; fee: number } | { kind: "unknown" };

// Política típica de bagagem despachada em econômica GRU–Europa (set/2026).
const BAG_POLICY: Record<string, BagPolicy> = {
  ET: { kind: "included" },
  AT: { kind: "included" },
  TK: { kind: "included" },
  EK: { kind: "included" },
  QR: { kind: "included" },
  EY: { kind: "included" },
  SA: { kind: "included" },
  LA: { kind: "light", fee: 528 },
  BA: { kind: "light", fee: 587 },
  TP: { kind: "light", fee: 470 },
  UX: { kind: "light", fee: 450 },
  AZ: { kind: "light", fee: 490 },
  AF: { kind: "light", fee: 520 },
  KL: { kind: "light", fee: 522 },
  LH: { kind: "light", fee: 540 },
  LX: { kind: "light", fee: 545 },
  UA: { kind: "light", fee: 510 },
  AC: { kind: "light", fee: 505 },
  AA: { kind: "light", fee: 530 },
  DL: { kind: "light", fee: 530 },
  AV: { kind: "light", fee: 480 },
  CM: { kind: "light", fee: 460 },
  G3: { kind: "light", fee: 480 },
  IB: { kind: "unknown" },
  SN: { kind: "unknown" },
  OS: { kind: "unknown" },
  LO: { kind: "unknown" },
  AY: { kind: "unknown" },
  SK: { kind: "unknown" },
  WS: { kind: "unknown" },
};

const AIRLINE_NAMES: Record<string, string> = {
  LA: "LATAM Airlines",
  BA: "British Airways",
  TP: "TAP Air Portugal",
  UX: "Air Europa",
  AZ: "ITA Airways",
  IB: "Iberia",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  LX: "SWISS",
  ET: "Ethiopian Airlines",
  AT: "Royal Air Maroc",
  TK: "Turkish Airlines",
  UA: "United Airlines",
  AC: "Air Canada",
  AA: "American Airlines",
  DL: "Delta Air Lines",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad Airways",
  AV: "Avianca",
  G3: "GOL",
  AR: "Aerolíneas Argentinas",
  CM: "Copa Airlines",
  SA: "South African Airways",
  SN: "Brussels Airlines",
  OS: "Austrian Airlines",
  LO: "LOT Polish",
  AY: "Finnair",
  SK: "SAS",
  WS: "WestJet",
};

const QUERY_MONTHS = ["2027-04", "2027-05", "2027-06", "2027-07", "2027-08"];

/* eslint-disable @typescript-eslint/no-explicit-any */

function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000
  );
}

export const travelpayoutsProvider = {
  name: "travelpayouts" as const,
  async scan(combos: DateCombo[], _at: Date): Promise<ScanResult> {
    const token = process.env.TRAVELPAYOUTS_TOKEN as string;
    const comboDays = new Map(combos.map((c) => [`${c.departDate}|${c.returnDate}`, c.tripDays]));
    const notes: string[] = [];
    const raw: any[] = [];

    // Uma chamada por mês de partida (limite folgado: 300 req/min no plano free)
    for (const month of QUERY_MONTHS) {
      const url =
        `${ENDPOINT}?origin=GRU&destination=LON&departure_at=${month}` +
        `&one_way=false&direct=false&unique=false&sorting=price&trip_class=0` +
        `&cy=brl&currency=brl&limit=100&page=1&token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`token Travelpayouts rejeitado (HTTP ${res.status})`);
      }
      if (!res.ok) {
        notes.push(`${month}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as any;
      const data: any[] = Array.isArray(json?.data) ? json.data : [];
      notes.push(`${month.replace("2027-", "")}/2027: ${data.length} tarifas reais em cache`);
      raw.push(...data);
    }

    if (!raw.length) {
      throw new Error(
        "nenhuma tarifa cacheada para GRU–LON na janela (sem buscas recentes dessas datas no Aviasales)"
      );
    }

    // Deduplicar + mapear para ofertas (mantém o mais barato por chave)
    const byKey = new Map<string, OfferDraft>();
    let newestFoundAt = "";
    let dayOrFlightNo = 0;

    for (const item of raw) {
      const dep = String(item?.departure_at ?? "").slice(0, 10);
      const ret = String(item?.return_at ?? "").slice(0, 10);
      if (!dep || !ret) continue;
      const days = comboDays.get(`${dep}|${ret}`);
      if (days === undefined) continue; // fora da janela ou duração ≠ 15–20
      const price = Math.round(Number(item?.price));
      if (!Number.isFinite(price) || price <= 0) continue;
      const code = String(item?.airline ?? "").toUpperCase() || "??";
      const policy = BAG_POLICY[code] ?? { kind: "unknown" as const };
      const stopsOut = Math.max(0, Number(item?.transfers ?? 0));
      const stopsBack = Math.max(0, Number(item?.return_transfers ?? stopsOut));
      const durOut = Number(item?.duration_to) > 0 ? Math.round(Number(item.duration_to)) : stopsOut === 0 ? 690 : 830 + stopsOut * 50;
      const durBack = Number(item?.duration_back) > 0 ? Math.round(Number(item.duration_back)) : stopsBack === 0 ? 700 : 860 + stopsBack * 50;
      const flight = item?.flight_number ? `${code} ${item.flight_number}` : `${code} ·`;
      if (String(item?.found_at ?? "") > newestFoundAt) newestFoundAt = String(item.found_at);
      const deepLink = item?.link
        ? `https://www.aviasales.com${item.link}`
        : `https://www.kayak.com.br/flights/GRU-LON/${dep}/${ret}?sort=bestflight_a`;

      const base: Omit<OfferDraft, "baggageIncluded" | "baggageNote" | "price" | "routeKey"> = {
        origin: "GRU",
        destination: "LON",
        departDate: dep,
        returnDate: ret,
        tripDays: days,
        airline: AIRLINE_NAMES[code] ?? code,
        airlineCode: code,
        flightOut: flight,
        flightBack: flight,
        stopsOut,
        stopsBack,
        viaOut: null,
        viaBack: null,
        durationOutMin: durOut,
        durationBackMin: durBack,
        cabin: "ECONOMY",
        currency: "BRL",
        deepLink,
      };

      const variants: OfferDraft[] = [];
      if (policy.kind === "included") {
        variants.push({
          ...base,
          price,
          baggageIncluded: true,
          baggageNote: "Tarifa real cacheada · mala despachada tipicamente incluída (política da companhia)",
          routeKey: `GRU|LON|${dep}|${ret}|${code}|BAG`,
        });
      } else if (policy.kind === "light") {
        variants.push({
          ...base,
          price,
          baggageIncluded: false,
          baggageNote: `Tarifa real cacheada · light: só mão (mala 23 kg ≈ +${policy.fee} na emissão)`,
          routeKey: `GRU|LON|${dep}|${ret}|${code}|LIGHT`,
        });
        variants.push({
          ...base,
          price: price + policy.fee,
          baggageIncluded: true,
          baggageNote: "Tarifa real cacheada + taxa típica de mala 23 kg (estimativa da companhia)",
          routeKey: `GRU|LON|${dep}|${ret}|${code}|BAG`,
        });
      } else {
        variants.push({
          ...base,
          price,
          baggageIncluded: false,
          baggageNote: "Tarifa real cacheada · franquia não informada pela fonte — confirmar na emissão",
          routeKey: `GRU|LON|${dep}|${ret}|${code}|LIGHT`,
        });
      }

      for (const v of variants) {
        const key = v.routeKey;
        const cur = byKey.get(key);
        if (!cur || v.price < cur.price) byKey.set(key, v);
        if (dayOrFlightNo < 0) dayOrFlightNo++;
      }
    }

    // Top 3 por combinação (com garantia de uma opção com bagagem)
    const perCombo = new Map<string, OfferDraft[]>();
    for (const v of byKey.values()) {
      const ck = `${v.departDate}|${v.returnDate}`;
      if (!perCombo.has(ck)) perCombo.set(ck, []);
      perCombo.get(ck)!.push(v);
    }
    const offers: OfferDraft[] = [];
    let combosWithOffers = 0;
    for (const list of perCombo.values()) {
      list.sort((a, b) => a.price - b.price);
      const picked = list.slice(0, 2);
      if (!picked.some((o) => o.baggageIncluded)) {
        const bestBag = list.find((o) => o.baggageIncluded);
        if (bestBag) picked.push(bestBag);
      }
      if (picked.length) combosWithOffers++;
      offers.push(...picked);
    }

    if (!offers.length) {
      throw new Error("cache do Aviasales sem pares de 15–20 dias para GRU–LON na janela");
    }

    notes.unshift(
      "Tarifas REAIS em cache (buscas de usuários Aviasales nas últimas ~48h) — não são cotações reserváveis."
    );
    if (newestFoundAt) notes.push(`tarifa mais recente encontrada em ${newestFoundAt}`);

    return {
      provider: "travelpayouts",
      offers,
      combosChecked: combos.length,
      coverage: {
        departuresChecked: QUERY_MONTHS.length,
        combosWithOffers,
        notes,
      },
    };
  },
};
