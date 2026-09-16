import { getDashboard } from "@/lib/analysis";
import { runScan } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboard();
    return Response.json({ scans: data.scans });
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("nenhuma tarifa cacheada")) {
      return Response.json(
        {
          available: false,
          error: message,
        },
        { status: 200 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

/** Dispara uma nova varredura real (persiste ofertas e alimenta o histórico). */
export async function POST() {
  try {
    const data = await getDashboard();
    const last = data.latest;
    if (last) {
      const elapsed = Date.now() - new Date(last.finishedAt).getTime();
      if (elapsed < 45_000) {
        return Response.json(
          {
            throttled: true,
            retryAfterSec: Math.ceil((45_000 - elapsed) / 1000),
            scanId: last.id,
          },
          { status: 429 }
        );
      }
    }
    const result = await runScan(new Date());
    return Response.json(result, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
