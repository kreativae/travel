import { getDashboard } from "@/lib/analysis";
import { hasTravelpayoutsToken } from "@/lib/providers/travelpayouts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboard();
    return Response.json({
      ...data,
      integrations: {
        travelpayouts: hasTravelpayoutsToken(),
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
