import { getRouteHistory } from "@/lib/analysis";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return Response.json({ error: "parâmetro 'key' (routeKey) é obrigatório" }, { status: 400 });
  }
  try {
    const points = await getRouteHistory(key);
    return Response.json({ routeKey: key, points });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
