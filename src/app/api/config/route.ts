import { NextResponse } from "next/server";
import { isApiKeyRequired } from "@/lib/apiAuth";

/**
 * Configuration publique de l'API modules.
 * N'expose jamais la valeur de la clé — seulement le fait qu'elle est exigée.
 */
export async function GET() {
  return NextResponse.json({
    apiKeyRequired: isApiKeyRequired(),
    telemetryEndpoint: "/api/telemetry",
  });
}
