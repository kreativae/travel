import { getDashboard } from "@/lib/analysis";
import { hasAmadeusKeys } from "@/lib/providers/amadeus";
import { hasTravelpayoutsToken } from "@/lib/providers/travelpayouts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboard();
    return Response.json({
      ...data,
      integrations: {
        travelpayouts: hasTravelpayoutsToken(),
        amadeus: hasAmadeusKeys(),
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
