import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { RANGE_HOURS, toCsv, type CsvRowSource, type HistoryRange } from "@/lib/history";

function parseRange(value: string | null): HistoryRange {
  return value && value in RANGE_HOURS ? (value as HistoryRange) : "30d";
}

/** Export CSV de l'historique agrégé, pour tableur ou rapport. */
export async function GET(request: NextRequest) {
  await store.ensureLoaded();

  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const antennaId = request.nextUrl.searchParams.get("antennaId");

  const antennas = store.getAntennas();
  const sites = store.getSites();
  const selected = antennaId ? antennas.filter((a) => a.id === antennaId) : antennas;

  if (antennaId && selected.length === 0) {
    return NextResponse.json({ error: "Antenne introuvable" }, { status: 404 });
  }

  const sources: CsvRowSource[] = [];
  for (const antenna of selected) {
    sources.push({
      antennaId: antenna.id,
      antennaName: antenna.name,
      siteName: sites.find((s) => s.id === antenna.siteId)?.name ?? "",
      buckets: await store.getHistory(antenna.id, range),
    });
  }

  const csv = toCsv(sources);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = antennaId
    ? `antennepatch-${antennaId}-${range}-${stamp}.csv`
    : `antennepatch-${range}-${stamp}.csv`;

  // BOM UTF-8 : sans lui, Excel affiche mal les accents.
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
