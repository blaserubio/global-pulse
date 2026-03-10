import type { OverviewStats } from "@/lib/types";
import { REGION_LABELS, REGION_COLORS } from "@/lib/utils";
import { Newspaper, Radio, Globe } from "lucide-react";

export function StatsBar({ stats }: { stats: OverviewStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-muted mb-1">
          <Newspaper className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Articles (24h)</span>
        </div>
        <p className="text-2xl font-bold">{stats.articles_last_24h.toLocaleString()}</p>
      </div>
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 text-muted mb-1">
          <Radio className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Active Sources</span>
        </div>
        <p className="text-2xl font-bold">{stats.active_sources}</p>
      </div>
      <div className="bg-surface border border-border rounded-lg p-4 col-span-2">
        <div className="flex items-center gap-2 text-muted mb-2">
          <Globe className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Regional Coverage</span>
        </div>
        <div className="flex items-center gap-3">
          {stats.regions.map((r) => (
            <div key={r.region} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${REGION_COLORS[r.region]}`} />
              <span className="text-xs text-muted">{REGION_LABELS[r.region]}</span>
              <span className="text-xs font-medium">{r.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
