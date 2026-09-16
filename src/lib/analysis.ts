// ---------------------------------------------------------------------------
// ANÁLISE — comparação entre varreduras (deltas absolutos e %), pulso de
// preço ao longo do tempo e histórico por combinação (routeKey).
// ---------------------------------------------------------------------------

import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { OfferWithDelta, PulsePoint, ScanSummary } from "./providers/types";

interface DashboardData {
  empty: boolean;
  scans: ScanSummary[];
  latest: ScanSummary | null;
  offers: OfferWithDelta[];
  pulse: PulsePoint[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function toScanSummary(r: any): ScanSummary {
  return {
    id: Number(r.id),
    provider: String(r.provider),
    startedAt: new Date(r.startedAt).toISOString(),
    finishedAt: new Date(r.finishedAt).toISOString(),
    offersCount: Number(r.offersCount),
    combosChecked: Number(r.combosChecked),
    durationMs: Number(r.durationMs),
    note: r.note ?? null,
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const scanRows = await db.execute(sql`
    SELECT id, provider,
           started_at  AS "startedAt",
           finished_at AS "finishedAt",
           offers_count AS "offersCount",
           combos_checked AS "combosChecked",
           duration_ms AS "durationMs",
           note
    FROM scans
    ORDER BY id DESC
    LIMIT 60
  `);
  const scansList = (scanRows.rows as any[]).map(toScanSummary);
  if (!scansList.length) {
    return { empty: true, scans: [], latest: null, offers: [], pulse: [] };
  }
  const latest = scansList[0];

  const offerRows = await db.execute(sql`
    SELECT o.id,
           o.route_key       AS "routeKey",
           o.origin, o.destination,
           o.depart_date     AS "departDate",
           o.return_date     AS "returnDate",
           o.trip_days       AS "tripDays",
           o.airline,
           o.airline_code    AS "airlineCode",
           o.flight_out      AS "flightOut",
           o.flight_back     AS "flightBack",
           o.stops_out       AS "stopsOut",
           o.stops_back      AS "stopsBack",
           o.via_out         AS "viaOut",
           o.via_back        AS "viaBack",
           o.duration_out_min  AS "durationOutMin",
           o.duration_back_min AS "durationBackMin",
           o.cabin,
           o.baggage_included AS "baggageIncluded",
           o.baggage_note     AS "baggageNote",
           o.price::float     AS price,
           o.currency,
           o.deep_link        AS "deepLink",
           p.prev_price       AS "prevPrice"
    FROM offers o
    LEFT JOIN LATERAL (
      SELECT po.price::float AS prev_price
      FROM offers po
      WHERE po.route_key = o.route_key AND po.scan_id < ${latest.id}
      ORDER BY po.scan_id DESC
      LIMIT 1
    ) p ON TRUE
    WHERE o.scan_id = ${latest.id}
    ORDER BY price ASC
  `);

  const offersList: OfferWithDelta[] = (offerRows.rows as any[]).map((r) => {
    const price = Number(r.price);
    const prev = r.prevPrice === null || r.prevPrice === undefined ? null : Number(r.prevPrice);
    const deltaAbs = prev === null ? null : price - prev;
    const deltaPct = prev === null || prev === 0 ? null : ((price - prev) / prev) * 100;
    return { ...r, price, prevPrice: prev, deltaAbs, deltaPct, isNew: prev === null };
  });

  const pulseRows = await db.execute(sql`
    SELECT s.id AS "scanId",
           s.finished_at AS at,
           (SELECT MIN(o.price::float) FROM offers o WHERE o.scan_id = s.id) AS "minPrice",
           (SELECT MIN(o.price::float) FROM offers o WHERE o.scan_id = s.id AND o.baggage_included) AS "minBagPrice",
           (SELECT AVG(x.p) FROM (
              SELECT o.price::float AS p FROM offers o
              WHERE o.scan_id = s.id ORDER BY o.price::float ASC LIMIT 10
           ) x) AS "avgTop10",
           s.offers_count AS offers
    FROM scans s
    ORDER BY s.id DESC
    LIMIT 14
  `);

  const pulse: PulsePoint[] = (pulseRows.rows as any[])
    .map((r) => ({
      scanId: Number(r.scanId),
      at: new Date(r.at).toISOString(),
      minPrice: Number(r.minPrice),
      minBagPrice: r.minBagPrice === null ? null : Number(r.minBagPrice),
      avgTop10: Number(r.avgTop10),
      offers: Number(r.offers),
    }))
    .reverse();

  return { empty: false, scans: scansList, latest, offers: offersList, pulse };
}

export interface HistoryPoint {
  scanId: number;
  at: string;
  price: number;
  prevPrice: number | null;
  deltaPct: number | null;
}

export async function getRouteHistory(routeKey: string): Promise<HistoryPoint[]> {
  const rows = await db.execute(sql`
    SELECT o.scan_id AS "scanId",
           s.finished_at AS at,
           o.price::float AS price
    FROM offers o
    JOIN scans s ON s.id = o.scan_id
    WHERE o.route_key = ${routeKey}
    ORDER BY o.scan_id ASC
  `);
  const points: HistoryPoint[] = [];
  let prev: number | null = null;
  for (const r of rows.rows as any[]) {
    const price = Number(r.price);
    points.push({
      scanId: Number(r.scanId),
      at: new Date(r.at).toISOString(),
      price,
      prevPrice: prev,
      deltaPct: prev === null || prev === 0 ? null : ((price - prev) / prev) * 100,
    });
    prev = price;
  }
  return points;
}
