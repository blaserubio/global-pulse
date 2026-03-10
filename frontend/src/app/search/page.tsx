"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { StoryCard } from "@/components/StoryCard";
import { ArticleCard } from "@/components/ArticleCard";
import { REGION_LABELS } from "@/lib/utils";
import { Search as SearchIcon, Loader2, Layers, Newspaper } from "lucide-react";
import type { StoryCluster, Article, Region } from "@/lib/types";

type Tab = "stories" | "articles";

const REGIONS: { value: string; label: string }[] = [
  { value: "", label: "All Regions" },
  ...Object.entries(REGION_LABELS).map(([value, label]) => ({ value, label })),
];

export default function SearchPage() {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [tab, setTab] = useState<Tab>("stories");
  const [storyOffset, setStoryOffset] = useState(0);
  const [articleOffset, setArticleOffset] = useState(0);
  const limit = 20;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setQuery(inputValue.trim());
    setStoryOffset(0);
    setArticleOffset(0);
  }

  // Build story search params
  const storyParams = new URLSearchParams();
  if (query) storyParams.set("search", query);
  if (region) storyParams.set("region", region);
  storyParams.set("limit", String(limit));
  storyParams.set("offset", String(storyOffset));

  // Build article search params
  const articleParams = new URLSearchParams();
  if (query) articleParams.set("search", query);
  if (region) articleParams.set("region", region);
  articleParams.set("limit", String(limit));
  articleParams.set("offset", String(articleOffset));

  // Only fetch when there's a query
  const { data: storiesData, isLoading: storiesLoading } = useSWR<{
    stories: StoryCluster[];
    total: number;
  }>(query ? `/stories?${storyParams.toString()}` : null, swrFetcher, {
    keepPreviousData: true,
  });

  const { data: articlesData, isLoading: articlesLoading } = useSWR<{
    articles: Article[];
    total: number;
  }>(query ? `/headlines?${articleParams.toString()}` : null, swrFetcher, {
    keepPreviousData: true,
  });

  const storyCount = storiesData?.total ?? 0;
  const articleCount = articlesData?.total ?? 0;
  const isLoading = tab === "stories" ? storiesLoading : articlesLoading;
  const hasSearched = query.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-2 flex items-center gap-3">
          <SearchIcon className="w-8 h-8 text-blue-400" />
          Search
        </h1>
        <p className="text-muted">
          Search across all stories and articles by keyword.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search for topics like war, climate, elections, trade..."
              className="w-full bg-surface border border-border rounded-xl pl-11 pr-4 py-3 text-base focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 disabled:text-white/30 text-white font-medium rounded-xl transition-colors"
          >
            Search
          </button>
        </div>

        {/* Region filter */}
        <div className="flex items-center gap-3 mt-3">
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              if (hasSearched) {
                setStoryOffset(0);
                setArticleOffset(0);
              }
            }}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {hasSearched && (
            <button
              type="button"
              onClick={() => {
                setInputValue("");
                setQuery("");
                setRegion("");
                setStoryOffset(0);
                setArticleOffset(0);
              }}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      </form>

      {/* Tabs - only show after search */}
      {hasSearched && (
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setTab("stories")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "stories"
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Layers className="w-4 h-4" />
            Stories
            {storyCount > 0 && (
              <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full">
                {storyCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("articles")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "articles"
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Newspaper className="w-4 h-4" />
            Articles
            {articleCount > 0 && (
              <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full">
                {articleCount}
              </span>
            )}
          </button>

          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted ml-auto" />
          )}
        </div>
      )}

      {/* Results */}
      {hasSearched && tab === "stories" && (
        <>
          {storiesData && storiesData.stories.length > 0 ? (
            <>
              <div className="space-y-4">
                {storiesData.stories.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>

              {storiesData.total > limit && (
                <Pagination
                  offset={storyOffset}
                  limit={limit}
                  total={storiesData.total}
                  onChange={setStoryOffset}
                />
              )}
            </>
          ) : (
            !storiesLoading && (
              <EmptyState query={query} type="stories" />
            )
          )}
        </>
      )}

      {hasSearched && tab === "articles" && (
        <>
          {articlesData && articlesData.articles.length > 0 ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {articlesData.articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>

              {articlesData.total > limit && (
                <Pagination
                  offset={articleOffset}
                  limit={limit}
                  total={articlesData.total}
                  onChange={setArticleOffset}
                />
              )}
            </>
          ) : (
            !articlesLoading && (
              <EmptyState query={query} type="articles" />
            )
          )}
        </>
      )}

      {/* Initial state — no search yet */}
      {!hasSearched && (
        <div className="text-center py-20 text-muted">
          <SearchIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">Search across all global news</p>
          <p className="text-sm max-w-md mx-auto">
            Try keywords like <Suggestion onClick={setInputValue} text="war" />,{" "}
            <Suggestion onClick={setInputValue} text="climate" />,{" "}
            <Suggestion onClick={setInputValue} text="election" />,{" "}
            <Suggestion onClick={setInputValue} text="trade" />, or{" "}
            <Suggestion onClick={setInputValue} text="technology" />
          </p>
        </div>
      )}
    </div>
  );
}

function Suggestion({ text, onClick }: { text: string; onClick: (v: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
    >
      {text}
    </button>
  );
}

function EmptyState({ query, type }: { query: string; type: string }) {
  return (
    <div className="text-center py-16 text-muted">
      <p className="text-lg mb-2">
        No {type} found for &ldquo;{query}&rdquo;
      </p>
      <p className="text-sm">Try a different keyword or broaden your search.</p>
    </div>
  );
}

function Pagination({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 mt-8">
      <button
        onClick={() => onChange(Math.max(0, offset - limit))}
        disabled={offset === 0}
        className="px-4 py-2 text-sm bg-surface border border-border rounded-lg disabled:opacity-30 hover:bg-surface-hover transition-colors"
      >
        Previous
      </button>
      <span className="text-sm text-muted">
        {offset + 1}&ndash;{Math.min(offset + limit, total)} of {total}
      </span>
      <button
        onClick={() => onChange(offset + limit)}
        disabled={offset + limit >= total}
        className="px-4 py-2 text-sm bg-surface border border-border rounded-lg disabled:opacity-30 hover:bg-surface-hover transition-colors"
      >
        Next
      </button>
    </div>
  );
}
