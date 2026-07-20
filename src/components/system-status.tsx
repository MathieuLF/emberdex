"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DatabaseBackup, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

const BACKUP_KEY = "emberdex:last-export";

type BackupSummary = {
  updatedAt: string;
  runCount: number;
  packCount: number;
};

type ExportedState = {
  runs?: Record<string, unknown>;
  packs?: Record<string, unknown>;
};

function readBackupSummary(): BackupSummary | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(BACKUP_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as BackupSummary;
  } catch {
    window.localStorage.removeItem(BACKUP_KEY);
    return null;
  }
}

export function SystemStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine
  );
  const [backup, setBackup] = useState<BackupSummary | null>(() => readBackupSummary());
  const [isPending, startTransition] = useTransition();

  const backupLabel = useMemo(() => {
    if (!backup) {
      return "Aucune sauvegarde locale";
    }

    return `${backup.runCount} partie${backup.runCount > 1 ? "s" : ""} en cache`;
  }, [backup]);

  async function refreshBackup() {
    const response = await fetch("/api/export", {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const state = (await response.json()) as ExportedState;
    const summary: BackupSummary = {
      updatedAt: new Date().toISOString(),
      runCount: Object.keys(state.runs ?? {}).length,
      packCount: Object.keys(state.packs ?? {}).length,
    };

    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(summary));
    window.localStorage.setItem(`${BACKUP_KEY}:payload`, JSON.stringify(state));
    setBackup(summary);
  }

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const refreshTimer = window.setTimeout(() => {
      if (window.navigator.onLine) {
        void refreshBackup().catch(() => undefined);
      }
    }, 0);

    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
          isOnline
            ? "border-[color:var(--success)]/35 text-[color:var(--success)]"
            : "border-[color:var(--warning)]/45 text-[color:var(--warning)]"
        )}
      >
        {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {isOnline ? "En ligne" : "Hors ligne"}
      </span>
      <span className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs font-medium text-[color:var(--muted)]">
        <DatabaseBackup className="h-3.5 w-3.5" />
        {backupLabel}
      </span>
      <Button
        type="button"
        variant="ghost"
        className="h-9 rounded-lg px-3 py-2 text-xs"
        onClick={() =>
          startTransition(() => {
            void refreshBackup().catch(() => undefined);
          })
        }
        disabled={!isOnline || isPending}
        title="Actualiser la sauvegarde locale"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
        Actualiser
      </Button>
    </div>
  );
}
