import { getSources } from "@/lib/api";
import { SourceBadges } from "@/components/SourceBadges";
import { REGION_LABELS, REGION_COLORS, countryFlag } from "@/lib/utils";
import type { Region } from "@/lib/types";

export const revalidate = 300;

export default async function SourcesPage() {
  const { sources } = await getSources();

  // Group sources by region
  const byRegion: Record<string, typeof sources> = {};
  for (const s of sources) {
    if (!byRegion[s.region]) byRegion[s.region] = [];
    byRegion[s.region].push(s);
  }

  const regions = Object.keys(byRegion) as Region[];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-2">Sources</h1>
        <p className="text-muted">
          {sources.length} news outlets tracked across {regions.length} global regions.
          Each source includes transparency metadata about funding, editorial lean, and factual accuracy.
        </p>
      </div>

      {/* Methodology */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-8">
        <h2 className="font-semibold mb-3">Bias Transparency Framework</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-blue-400 mb-1">Editorial Lean</h3>
            <p className="text-muted">Assessed position on the political spectrum from left to right, based on editorial board positions and coverage patterns.</p>
          </div>
          <div>
            <h3 className="font-medium text-emerald-400 mb-1">Funding Model</h3>
            <p className="text-muted">How the outlet is financed: state-funded, public broadcast, private ownership, or nonprofit.</p>
          </div>
          <div>
            <h3 className="font-medium text-amber-400 mb-1">Factual Rating</h3>
            <p className="text-muted">Track record of factual accuracy and corrections, from established media watchdog assessments.</p>
          </div>
        </div>
      </div>

      {/* Sources by Region */}
      <div className="space-y-10">
        {regions.map((region) => (
          <section key={region}>
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-4">
              <span className={`w-3 h-3 rounded-full ${REGION_COLORS[region]}`} />
              {REGION_LABELS[region]}
              <span className="text-sm font-normal text-muted ml-1">({byRegion[region].length} sources)</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {byRegion[region].map((source) => (
                <div key={source.id} className="bg-surface border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{countryFlag(source.country_code)}</span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-blue-400 transition-colors"
                    >
                      {source.name}
                    </a>
                    {source.article_count_24h !== undefined && source.article_count_24h > 0 && (
                      <span className="ml-auto text-xs text-muted">
                        {source.article_count_24h} articles (24h)
                      </span>
                    )}
                  </div>
                  {source.ownership && (
                    <p className="text-xs text-muted mb-2">{source.ownership}</p>
                  )}
                  <SourceBadges source={source} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
