import type { DateCombo } from "@/lib/dates";

/** Oferta pronta para persistir (antes de receber scanId). */
export interface OfferDraft {
  routeKey: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  tripDays: number;
  airline: string;
  airlineCode: string;
  flightOut: string | null;
  flightBack: string | null;
  stopsOut: number;
  stopsBack: number;
  viaOut: string | null;
  viaBack: string | null;
  durationOutMin: number;
  durationBackMin: number;
  cabin: string;
  baggageIncluded: boolean;
  baggageNote: string;
  price: number;
  currency: string;
  deepLink: string | null;
}

export interface ScanCoverage {
  departuresChecked: number;
  combosWithOffers: number;
  notes: string[];
}

export type ProviderName = "travelpayouts" | "amadeus" | "market";

export interface ScanResult {
  provider: ProviderName;
  offers: OfferDraft[];
  combosChecked: number;
  coverage: ScanCoverage;
  note?: string;
}

export interface Provider {
  name: ProviderName;
  scan(combos: DateCombo[], at: Date): Promise<ScanResult>;
}

/** Oferta como sai da API do dashboard, já com comparação histórica. */
export interface OfferWithDelta extends Omit<OfferDraft, "price"> {
  id: number;
  price: number;
  prevPrice: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  isNew: boolean;
}

export interface ScanSummary {
  id: number;
  provider: string;
  startedAt: string;
  finishedAt: string;
  offersCount: number;
  combosChecked: number;
  durationMs: number;
  note: string | null;
}

export interface PulsePoint {
  scanId: number;
  at: string;
  minPrice: number;
  minBagPrice: number | null;
  avgTop10: number;
  offers: number;
}
