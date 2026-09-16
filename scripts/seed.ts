/**
 * SEED — gera 5 varreduras históricas (T-9d … T-3h) para que o sistema já
 * abra com histórico real de varredura-para-varredura: deltas, percentuais
 * e pulso de preço. Como o motor é determinístico por data, as varreduras
 * futuras se encaixam na mesma linha evolutiva.
 *
 * Uso: npx tsx scripts/seed.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { runScan } from "../src/lib/scanner";

const DAY = 86400000;

async function main() {
  console.log("Limpando histórico anterior…");
  await db.execute(sql`TRUNCATE offers, scans RESTART IDENTITY CASCADE`);

  const offsetsDays = [9, 6, 4, 2, 0.15]; // última varredura há ~3,6 h
  for (const d of offsetsDays) {
    const at = new Date(Date.now() - d * DAY);
    const r = await runScan(at);
    console.log(
      `✓ varredura #${r.scanId} @ ${at.toISOString()} → ${r.offersCount} ofertas ` +
        `(${r.combosChecked} combinações, ${r.durationMs} ms, provedor: ${r.provider})`
    );
  }
  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error("Falha no seed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
