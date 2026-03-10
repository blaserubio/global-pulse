"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { REGION_LABELS, TOPIC_COLORS } from "@/lib/utils";
import type { Region } from "@/lib/types";

const ALL_REGIONS: { value: Region; label: string }[] = [
  { value: "americas", label: "Americas" },
  { value: "europe", label: "Europe" },
  { value: "asia_pacific", label: "Asia-Pacific" },
  { value: "mideast_africa", label: "Middle East & Africa" },
];

const ALL_TOPICS = Object.keys(TOPIC_COLORS);

const TIME_RANGES = [
  { value: "1", label: "Last hour" },
  { value: "6", label: "Last 6 hours" },
  { value: "24", label: "Last 24 hours" },
  { value: "72", label: "Last 3 days" },
  { value: "168", label: "Last week" },
  { value: "", label: "All time" },
];

const SORT_OPTIONS = [
  { value: "significance", label: "Significance" },
  { value: "recent", label: "Most Recent" },
  { value: "sources", label: "Most Sources" },
  { value: "regions", label: "Most Regions" },
];

export interface FilterState {
  search: string;
  regions: Region[];
  topics: string[];
  timeRange: string; // hours as string, "" = all time
  sort: string;
}

interface FilterToolbarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  resultCount: number;
  totalCount: number;
}

export function FilterToolbar({ filters, onFiltersChange, resultCount, totalCount }: FilterToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const activeFilterCount =
    filters.regions.length +
    filters.topics.length +
    (filters.timeRange ? 1 : 0) +
    (filters.sort !== "significance" ? 1 : 0);

  // Sync filters to URL
  useEffect(() => {
    const sp = new URLSearchParams();
    if (filters.search) sp.set("q", filters.search);
    if (filters.regions.length) sp.set("region", filters.regions.join(","));
    if (filters.topics.length) sp.set("topic", filters.topics.join(","));
    if (filters.timeRange) sp.set("hours", filters.timeRange);
    if (filters.sort !== "significance") sp.set("sort", filters.sort);
    const qs = sp.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [filters, router]);

  // Initialize filters from URL on mount
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const region = searchParams.get("region");
    const topic = searchParams.get("topic");
    const hours = searchParams.get("hours") || "";
    const sort = searchParams.get("sort") || "significance";

    const initial: FilterState = {
      search: q,
      regions: region ? (region.split(",") as Region[]) : [],
      topics: topic ? topic.split(",") : [],
      timeRange: hours,
      sort,
    };

    // Only update if different from current
    if (JSON.stringify(initial) !== JSON.stringify(filters)) {
      onFiltersChange(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchChange(value: string) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, search: value });
    }, 300);
  }

  function toggleRegion(region: Region) {
    const next = filters.regions.includes(region)
      ? filters.regions.filter((r) => r !== region)
      : [...filters.regions, region];
    onFiltersChange({ ...filters, regions: next });
  }

  function toggleTopic(topic: string) {
    const next = filters.topics.includes(topic)
      ? filters.topics.filter((t) => t !== topic)
      : [...filters.topics, topic];
    onFiltersChange({ ...filters, topics: next });
  }

  function clearAll() {
    onFiltersChange({ search: "", regions: [], topics: [], timeRange: "", sort: "significance" });
    if (searchRef.current) searchRef.current.value = "";
  }

  return (
    <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border pb-4 mb-6 -mx-4 px-4 pt-4">
      {/* Search bar */}
      <div className="relative mb-3">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchFocused ? "text-[#e94560]" : "text-muted"}`} />
        <input
          ref={searchRef}
          type="text"
          defaultValue={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search stories by keyword, topic, or country..."
          className="w-full bg-white/[0.06] border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm placeholder:text-foreground/40 focus:outline-none focus:border-white/20 transition-colors"
        />
        {filters.search && (
          <button
            onClick={() => { onFiltersChange({ ...filters, search: "" }); if (searchRef.current) searchRef.current.value = ""; }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mobile filter toggle */}
      <div className="md:hidden mb-3">
        <button
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground bg-surface border border-border rounded-lg px-3 py-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-[#e94560] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Filter controls */}
      <div className={`space-y-3 ${mobileFiltersOpen ? "block" : "hidden"} md:block`}>
        {/* Row 1: Region pills + Sort + Time */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted uppercase tracking-wider mr-1">Region</span>
          {ALL_REGIONS.map((r) => {
            const active = filters.regions.includes(r.value);
            return (
              <button
                key={r.value}
                onClick={() => toggleRegion(r.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                  active
                    ? "bg-[#e94560]/20 border-[#e94560]/50 text-[#e94560]"
                    : "bg-white/[0.04] border-border text-muted hover:text-foreground hover:border-white/20"
                }`}
              >
                {r.label}
              </button>
            );
          })}

          <span className="w-px h-5 bg-border mx-1 hidden md:block" />

          {/* Time range */}
          <select
            value={filters.timeRange}
            onChange={(e) => onFiltersChange({ ...filters, timeRange: e.target.value })}
            className="bg-white/[0.06] border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-white/20"
          >
            {TIME_RANGES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={filters.sort}
            onChange={(e) => onFiltersChange({ ...filters, sort: e.target.value })}
            className="bg-white/[0.06] border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-white/20"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Row 2: Topic pills (scrollable) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-muted uppercase tracking-wider mr-1 shrink-0">Topic</span>
          {ALL_TOPICS.map((topic) => {
            const active = filters.topics.includes(topic);
            const colors = TOPIC_COLORS[topic] || "";
            return (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap transition-all ${
                  active
                    ? `${colors} border-white/20`
                    : "bg-white/[0.04] border-border text-muted hover:text-foreground hover:border-white/20"
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>

        {/* Result count + Clear all */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">
            Showing <span className="text-foreground font-medium">{resultCount}</span> of {totalCount} stories
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-[#e94560] hover:text-[#e94560]/80 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
