import { NextResponse } from "next/server";
import { fetchNetworkAnalyses } from "@/lib/network";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const analyses = await fetchNetworkAnalyses();
    return NextResponse.json(
      { analyses },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error("[api/network/analyses] failed:", error);
    return NextResponse.json({ error: "network_unavailable" }, { status: 502 });
  }
}
