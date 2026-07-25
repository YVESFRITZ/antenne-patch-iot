import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Clé API attendue des modules (Arduino / ESP32).
 * Définie côté serveur via la variable d'environnement ANTENNE_API_KEY.
 * Elle n'est jamais exposée au navigateur (pas de préfixe NEXT_PUBLIC_).
 */
function expectedKey(): string | null {
  const key = process.env.ANTENNE_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

/** Comparaison à temps constant (évite les attaques temporelles). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Extrait la clé fournie par le client (en-tête x-api-key ou Bearer). */
function presentedKey(request: NextRequest): string | null {
  const header = request.headers.get("x-api-key");
  if (header) return header.trim();

  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  return null;
}

export interface AuthResult {
  ok: boolean;
  /** Renseigné uniquement en cas de refus. */
  error?: string;
  /** true si aucune clé n'est configurée sur le serveur (mode ouvert). */
  open?: boolean;
}

/**
 * Vérifie l'autorisation d'un module.
 * Si aucune clé n'est configurée sur le serveur, l'accès reste ouvert
 * (utile en développement local) ; sinon la clé est obligatoire.
 */
export function authorizeDevice(request: NextRequest): AuthResult {
  const expected = expectedKey();
  if (!expected) return { ok: true, open: true };

  const presented = presentedKey(request);
  if (!presented) {
    return { ok: false, error: "Clé API manquante (en-tête x-api-key)" };
  }
  if (!safeEqual(presented, expected)) {
    return { ok: false, error: "Clé API invalide" };
  }
  return { ok: true };
}

/** Indique si une clé API est exigée (sans jamais révéler sa valeur). */
export function isApiKeyRequired(): boolean {
  return expectedKey() !== null;
}
