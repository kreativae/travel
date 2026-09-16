// ---------------------------------------------------------------------------
// ORQUESTRADOR DE VARREDURAS
// Executa uma varredura completa (provedor ativo) e persiste scan + ofertas.
// O histórico acumulado permite comparação entre varreduras (deltas e %).
// ---------------------------------------------------------------------------

import { db } from "@/db";
import { offers, scans } from "@/db/schema";
import { desc } from "drizzle-orm";
import { buildCombos } from "./dates";
import { hasTravelpayoutsToken, travelpayoutsProvider } from "./providers/travelpayouts";
import type { ScanResult } from "./providers/types";

export interface RunScanOutput {
  scanId: number;
  provider: string;
  offersCount: number;
  combosChecked: number;
  durationMs: number;
  note: string | null;
}

export async function runScan(at: Date = new Date()): Promise<RunScanOutput> {
  const t0 = Date.now();
  const combos = buildCombos();

  if (!hasTravelpayoutsToken()) {
    throw new Error("TRAVELPAYOUTS_TOKEN não configurado");
  }

  const result: ScanResult = await travelpayoutsProvider.scan(combos, at);

  const durationMs = Math.max(Date.now() - t0, 1);
  const finishedAt = new Date(at.getTime() + durationMs);

  const [scan] = await db
    .insert(scans)
    .values({
      provider: result.provider,
      status: "done",
      startedAt: at,
      finishedAt,
      offersCount: result.offers.length,
      combosChecked: result.combosChecked,
      durationMs,
      coverage: result.coverage,
      note: result.note ?? null,
    })
    .returning();

  const CHUNK = 800;
  for (let i = 0; i < result.offers.length; i += CHUNK) {
    const slice = result.offers.slice(i, i + CHUNK);
    await db.insert(offers).values(
      slice.map((o) => ({
        ...o,
        price: o.price.toFixed(2),
        scanId: scan.id,
        createdAt: finishedAt,
      }))
    );
  }

  return {
    scanId: scan.id,
    provider: result.provider,
    offersCount: result.offers.length,
    combosChecked: result.combosChecked,
    durationMs,
    note: result.note ?? null,
  };
}

export async function latestScanId(): Promise<number | null> {
  const rows = await db
    .select({ id: scans.id })
    .from(scans)
    .orderBy(desc(scans.id))
    .limit(1);
  return rows[0]?.id ?? null;
}
