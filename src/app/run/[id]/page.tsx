import { notFound } from "next/navigation";
import { describeRulePreset, summarizeRun } from "@emberdex/core";
import { readAppState } from "@/lib/store";
import { Pill, Card, StatCard } from "@/components/ui";
import { RunWorkbench } from "@/components/run-workbench";
import { RunGuidance } from "@/components/run-guidance";
import { getGameForRun } from "@/lib/game-catalog";
import { formatRuleMode, formatRunStatus } from "@/lib/rule-labels";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const state = await readAppState();
  const lookupId = id.trim();
  const run = state.runs[lookupId] ?? state.runs[lookupId.toUpperCase()];

  if (!run) {
    notFound();
  }

  const pack = state.packs[run.rulesetId] ?? Object.values(state.packs)[0];
  const summary = summarizeRun(run);
  const gameProfile = getGameForRun(run.gameTitle, run.versionGroup);

  const activeRulesCount = describeRulePreset(run.rules).length;

  return (
    <div className="page-reveal space-y-6">
      <Card className="relative overflow-hidden p-7 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[color:var(--accent)]/10 blur-3xl" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative space-y-5">
            <div className="flex flex-wrap gap-2">
              <Pill tone="accent">Code {run.id}</Pill>
              <Pill>{run.gameTitle}</Pill>
              <Pill>{formatRuleMode(run.ruleMode)}</Pill>
              <Pill>{pack?.name ?? "Pack personnalisé"}</Pill>
              <Pill tone={run.status === "active" ? "success" : run.status === "failed" ? "danger" : "default"}>{formatRunStatus(run.status)}</Pill>
            </div>

            <div className="max-w-4xl space-y-4">
              <p className="text-[11px] uppercase tracking-[0.34em] text-[color:var(--muted)]">
                Votre aventure
              </p>
              <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold text-[color:var(--text)] sm:text-5xl lg:text-6xl">
                {run.name}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[color:var(--muted)]">
                {run.currentLocation ?? run.currentRoute ?? "Prochaine étape à définir"} · Dernière mise à jour{" "}
                <span suppressHydrationWarning>{formatDate(run.updatedAt)}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:min-w-[22rem]">
            <StatCard label="En vie" value={summary.alive} tone="success" />
            <StatCard label="Décédés" value={summary.fallen} tone="danger" />
            <StatCard label="Taux de capture" value={`${summary.captureRate}%`} tone="accent" />
            <StatCard label="Étapes" value={run.badges.length} tone="warning" />
          </div>
        </div>
      </Card>

      <RunGuidance run={run} />

      <RunWorkbench
        run={run}
        pack={pack}
        gameProfile={gameProfile}
        activeRulesCount={activeRulesCount}
      />
    </div>
  );
}
