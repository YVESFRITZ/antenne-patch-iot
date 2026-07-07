import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const { alertId } = await request.json();
    if (!alertId) {
      return NextResponse.json({ error: "alertId requis" }, { status: 400 });
    }
    store.acknowledgeAlert(alertId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
}
