"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseSerialLine, type ParsedFrame } from "@/lib/serialParse";
import type { AntennaPayload } from "@/lib/types";

export interface SerialLogEntry {
  id: number;
  at: number;
  kind: ParsedFrame["kind"];
  text: string;
}

const MAX_LOG = 60;

export interface UseSerialOptions {
  /** Antenne cible si le module n'envoie pas d'antennaId. */
  fallbackAntennaId?: string;
  /** Clé API à présenter au serveur (en-tête x-api-key). */
  apiKey?: string;
  /** Transmettre les mesures reçues à l'application. */
  forward?: boolean;
}

export function useSerialDevice(options: UseSerialOptions = {}) {
  const { fallbackAntennaId, apiKey, forward = true } = options;

  const [supported, setSupported] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<SerialLogEntry[]>([]);
  const [lastPayload, setLastPayload] = useState<Partial<AntennaPayload> | null>(null);
  const [framesReceived, setFramesReceived] = useState(0);
  const [framesSent, setFramesSent] = useState(0);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReading = useRef(false);
  const logId = useRef(0);
  // Options lues dans la boucle de lecture : gardées en ref pour éviter
  // de relancer la connexion à chaque changement.
  const optsRef = useRef({ fallbackAntennaId, apiKey, forward });
  optsRef.current = { fallbackAntennaId, apiKey, forward };

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && !!navigator.serial);
  }, []);

  const pushLog = useCallback((kind: ParsedFrame["kind"], text: string) => {
    setLog((prev) => {
      const entry: SerialLogEntry = { id: logId.current++, at: Date.now(), kind, text };
      const next = [entry, ...prev];
      return next.length > MAX_LOG ? next.slice(0, MAX_LOG) : next;
    });
  }, []);

  /** Envoie la mesure reçue à l'API de l'application. */
  const forwardPayload = useCallback(
    async (payload: Partial<AntennaPayload>) => {
      const { fallbackAntennaId: fallback, apiKey: key } = optsRef.current;
      const antennaId = payload.antennaId ?? fallback;
      if (!antennaId) return;

      try {
        const res = await fetch("/api/telemetry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(key ? { "x-api-key": key } : {}),
          },
          body: JSON.stringify({ ...payload, antennaId }),
        });
        if (res.ok) {
          setFramesSent((n) => n + 1);
          return;
        }
        const data = await res.json().catch(() => ({}));
        setError(
          res.status === 401
            ? `Refusé par l'application : ${data.error ?? "clé API requise"}`
            : `Erreur ${res.status} : ${data.error ?? "envoi impossible"}`
        );
      } catch {
        setError("Impossible de joindre l'application");
      }
    },
    []
  );

  /** Boucle de lecture : décode le flux et traite chaque ligne. */
  const readLoop = useCallback(
    async (port: SerialPort) => {
      const decoder = new TextDecoder();
      let buffer = "";

      while (keepReading.current && port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        try {
          while (keepReading.current) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            // La dernière portion peut être incomplète : on la garde.
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;
              const frame = parseSerialLine(line);
              setFramesReceived((n) => n + 1);
              pushLog(frame.kind, frame.raw);

              if (frame.payload) {
                setLastPayload((prev) => ({ ...prev, ...frame.payload }));
                if (optsRef.current.forward) await forwardPayload(frame.payload);
              }
            }
          }
        } catch (err) {
          if (keepReading.current) {
            setError(err instanceof Error ? err.message : "Erreur de lecture du port");
          }
          break;
        } finally {
          try {
            reader.releaseLock();
          } catch {
            // port déjà fermé
          }
          readerRef.current = null;
        }
      }
    },
    [forwardPayload, pushLog]
  );

  const disconnect = useCallback(async () => {
    keepReading.current = false;
    try {
      await readerRef.current?.cancel();
    } catch {
      // ignore
    }
    try {
      await portRef.current?.close();
    } catch {
      // ignore
    }
    portRef.current = null;
    setConnected(false);
  }, []);

  const connect = useCallback(
    async (baudRate = 115200) => {
      setError(null);
      if (typeof navigator === "undefined" || !navigator.serial) {
        setError(
          "Web Serial non disponible : utilisez Chrome ou Edge sur ordinateur (non supporté sur mobile ni Firefox/Safari)."
        );
        return;
      }

      setConnecting(true);
      try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate });
        portRef.current = port;
        keepReading.current = true;
        setConnected(true);
        pushLog("text", `— Port ouvert à ${baudRate} bauds —`);
        void readLoop(port);
      } catch (err) {
        // L'utilisateur a fermé le sélecteur de port sans choisir : pas une erreur.
        const message = err instanceof Error ? err.message : String(err);
        if (!/No port selected|cancel/i.test(message)) {
          setError(`Connexion impossible : ${message}`);
        }
      } finally {
        setConnecting(false);
      }
    },
    [pushLog, readLoop]
  );

  // Fermeture propre du port au démontage du composant.
  useEffect(() => {
    return () => {
      keepReading.current = false;
      readerRef.current?.cancel().catch(() => {});
      portRef.current?.close().catch(() => {});
    };
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  return {
    supported,
    connected,
    connecting,
    error,
    log,
    lastPayload,
    framesReceived,
    framesSent,
    connect,
    disconnect,
    clearLog,
  };
}
