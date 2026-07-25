import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { RANGE_HOURS, type HistoryRange } from "@/lib/history";

function parseRange(value: string | null): HistoryRange {
  return value && value in RANGE_HOURS ? (value as HistoryRange) : "24h";
}

export async function GET(request: NextRequest) {
  await store.ensureLoaded();

  const antennaId = request.nextUrl.searchParams.get("antennaId");
  const range = parseRange(request.nextUrl.searchParams.get("range"));

  if (antennaId) {
    const buckets = await store.getHistory(antennaId, range);
    return NextResponse.json({ range, antennaId, buckets });
  }

  return NextResponse.json({ range, history: await store.getAllHistory(range) });
}
