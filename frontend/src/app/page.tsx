"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { StoryCard } from "@/components/StoryCard";
import { StatsBar } from "@/components/StatsBar";
import { RefreshButton } from "@/components/RefreshButton";
import { FilterToolbar, type FilterState } from "@/components/FilterToolbar";
import type { StoryCluster, OverviewStats, Region } from "@/lib/types";
import { REGION_LABELS } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

function StoryFeed() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    regions: [],
    topics: [],
    timeRange: "",
    sort: "significance",
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

  const { data: storiesData, mutate: mutateStories, isLoading: storiesLoading } = useSWR<{
    stories: StoryCluster[];
    total: number;
  }>("/stories?limit=100", swrFetcher, { revalidateOnFocus: false });

  const { data: stats } = useSWR<OverviewStats>("/stats/overview", swrFetcher, {
    revalidateOnFocus: false,
  });

  const allStories = storiesData?.stories || [];

  // Client-side filtering
  const filteredStories = useMemo(() => {
    let result = [...allStories];

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((s) => {
        const title = (s.canonical_title || "").toLowerCase();
        const summary = (s.summary || "").toLowerCase();
        const topic = (s.topic || "").toLowerCase();
        const regions = s.regions.map((r) => REGION_LABELS[r].toLowerCase()).join(" ");
        const countries = (s.countries || []).join(" ").toLowerCase();
        return title.includes(q) || summary.includes(q) || topic.includes(q) || regions.includes(q) || countries.includes(q);
      });
    }

    // Region filter
    if (filters.regions.length > 0) {
      result = result.filter((s) =>
        s.regions.some((r) => filters.regions.includes(r))
      );
    }

    // Topic filter
    if (filters.topics.length > 0) {
      result = result.filter((s) => s.topic && filters.topics.includes(s.topic));
    }

    // Time range filter
    if (filters.timeRange) {
      const cutoff = new Date(Date.now() - parseInt(filters.timeRange) * 60 * 60 * 1000);
      result = result.filter((s) => s.first_seen && new Date(s.first_seen) >= cutoff);
    }

    // Sort
    switch (filters.sort) {
      case "recent":
        result.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
        break;
      case "sources":
        result.sort((a, b) => b.source_count - a.source_count);
        break;
      case "regions":
        result.sort((a, b) => b.region_count - a.region_count);
        break;
      case "significance":
      default:
        result.sort((a, b) => b.significance - a.significance);
        break;
    }

    return result;
  }, [allStories, filters]);

  // Refresh handler: triggers backend ingestion, then re-fetches stories
  const handleRefresh = useCallback(async (): Promise<number> => {
    const prevIds = new Set(allStories.map((s) => s.id));

    // Trigger backend ingestion
    await fetch(`${API_BASE}/admin/ingest`, { method: "POST" });

    // Wait a moment for ingestion to start processing
    await new Promise((r) => setTimeout(r, 2000));

    // Re-fetch stories
    const fresh = await mutateStories();
    setLastUpdated(new Date());

    if (!fresh) return 0;
    const newStories = fresh.stories.filter((s) => !prevIds.has(s.id));
    return newStories.length;
  }, [allStories, mutateStories]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold mb-2">Global Stories</h1>
        <p className="text-muted">
          One event, many lenses. Stories ranked by global significance and multi-perspective coverage.
        </p>
      </div>

      {stats && <StatsBar stats={stats} />}

      <FilterToolbar
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={filteredStories.length}
        totalCount={allStories.length}
      />

      {storiesLoading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading stories...
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {allStories.length === 0 ? (
            <>
              <p className="text-lg mb-2">No story clusters yet.</p>
              <p className="text-sm">Run the intelligence pipeline to cluster articles into stories.</p>
            </>
          ) : (
            <>
              <p className="text-lg mb-2">No stories match your filters</p>
              <button
                onClick={() => setFilters({ search: "", regions: [], topics: [], timeRange: "", sort: "significance" })}
                className="text-sm text-[#e94560] hover:text-[#e94560]/80 transition-colors mt-2"
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStories.map((story) => (
            <div key={story.id} className="animate-fade-in">
              <StoryCard story={story} />
            </div>
          ))}
        </div>
      )}

      <RefreshButton onRefresh={handleRefresh} lastUpdated={lastUpdated} />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh] text-muted">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading...
      </div>
    }>
      <StoryFeed />
    </Suspense>
  );
}
