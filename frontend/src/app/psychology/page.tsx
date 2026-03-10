"use client";

import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import type { PsychologyMap, PsychologyTactic } from "@/lib/types";
import { Brain, ChevronDown, ChevronUp, AlertTriangle, Loader2, BookOpen } from "lucide-react";

function TacticCard({ tactic, rank, maxCount }: { tactic: PsychologyTactic; rank: number; maxCount: number }) {
  const [expanded, setExpanded] = useState(false);
  const barWidth = Math.max((tactic.count / maxCount) * 100, 8);

  // Color gradient from red (most used) to amber to blue (least used)
  const getColor = (pct: number) => {
    if (pct >= 70) return { bar: "bg-red-500", badge: "bg-red-500/20 text-red-300 border-red-500/30", glow: "shadow-red-500/10" };
    if (pct >= 50) return { bar: "bg-orange-500", badge: "bg-orange-500/20 text-orange-300 border-orange-500/30", glow: "shadow-orange-500/10" };
    if (pct >= 30) return { bar: "bg-amber-500", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30", glow: "shadow-amber-500/10" };
    if (pct >= 15) return { bar: "bg-sky-500", badge: "bg-sky-500/20 text-sky-300 border-sky-500/30", glow: "shadow-sky-500/10" };
    return { bar: "bg-slate-500", badge: "bg-slate-500/20 text-slate-300 border-slate-500/30", glow: "shadow-slate-500/10" };
  };

  const colors = getColor(tactic.percentage);

  return (
    <div
      className={`bg-surface border border-border rounded-xl overflow-hidden transition-all duration-200 hover:border-blue-500/20 ${colors.glow}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 flex items-start gap-4"
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center font-serif font-bold text-lg text-muted">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-serif text-lg font-semibold">{tactic.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${colors.badge}`}>
              {tactic.percentage}% of stories
            </span>
          </div>

          {/* Description */}
          <p className="text-muted text-sm leading-relaxed mb-3">
            {tactic.description}
          </p>

          {/* Usage bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="text-xs text-muted flex-shrink-0 w-20 text-right">
              {tactic.count} {tactic.count === 1 ? "story" : "stories"}
            </span>
          </div>
        </div>

        {/* Expand icon */}
        <div className="flex-shrink-0 mt-1 text-muted">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border/50 pt-4 ml-14">
          {/* Why it's used */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-semibold text-amber-400">Why News Uses This</h4>
            </div>
            <p className="text-base leading-[1.7] text-foreground/90">
              {tactic.why_used}
            </p>
          </div>

          {/* Example stories */}
          {tactic.examples.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <h4 className="text-sm font-semibold text-sky-400">Examples in Today&apos;s News</h4>
              </div>
              <ul className="space-y-1.5">
                {tactic.examples.map((ex, i) => (
                  <li key={i} className="text-sm text-muted flex items-start gap-2">
                    <span className="text-muted/50 mt-0.5">&bull;</span>
                    <span className="italic">&ldquo;{ex}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PsychologyPage() {
  const { data, isLoading, error } = useSWR<PsychologyMap>(
    "/psychology-map",
    swrFetcher,
    { revalidateOnFocus: false }
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <h1 className="font-serif text-3xl font-bold">Psychology Map</h1>
        </div>
        <p className="text-muted text-base leading-relaxed max-w-2xl">
          An AI analysis of the psychological tactics and persuasion techniques
          being used across today&apos;s global news coverage. Understanding these
          patterns helps you read the news more critically.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="text-lg mb-1">Analyzing psychology tactics...</p>
          <p className="text-sm">This may take a moment on first load.</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-2">Failed to load psychology analysis.</p>
          <p className="text-sm">Please try refreshing the page.</p>
        </div>
      )}

      {/* Results */}
      {data && data.tactics.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-muted">
              <span className="text-foreground font-semibold">{data.tactics.length}</span> psychological tactics identified across{" "}
              <span className="text-foreground font-semibold">{data.story_count}</span> stories
            </span>
            {data.generated_at && (
              <span className="text-xs text-muted/60">
                Updated {new Date(data.generated_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Tactic list */}
          <div className="space-y-3">
            {data.tactics.map((tactic, i) => (
              <TacticCard
                key={tactic.name}
                tactic={tactic}
                rank={i + 1}
                maxCount={data.tactics[0].count}
              />
            ))}
          </div>

          {/* Footer disclaimer */}
          <div className="mt-8 p-4 bg-white/5 rounded-xl border border-border/50 text-center">
            <p className="text-xs text-muted/70 leading-relaxed">
              This analysis is generated by AI examining how news outlets frame stories.
              Psychological tactics are inherent to all communication — their presence doesn&apos;t
              necessarily indicate manipulation. Use this as a lens for more critical reading.
            </p>
          </div>
        </>
      )}

      {/* Empty state */}
      {data && data.tactics.length === 0 && !data.error && (
        <div className="text-center py-16 text-muted">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">No analysis available yet.</p>
          <p className="text-sm">Stories need to be clustered before psychology analysis can run.</p>
        </div>
      )}
    </div>
  );
}
