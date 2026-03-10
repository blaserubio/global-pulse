import Link from "next/link";
import type { StoryCluster } from "@/lib/types";
import { RegionDots } from "./RegionDots";
import { TopicBadge } from "./TopicBadge";
import { timeAgo, REGION_LABELS } from "@/lib/utils";
import { Layers, Globe, Newspaper, TrendingUp, Flame } from "lucide-react";

export function StoryCard({ story }: { story: StoryCluster }) {
  const title = story.canonical_title || `Story cluster (${story.article_count} articles)`;
  const secondaryTopics = (story.topics || []).slice(1, 3);
  const isRising = story.velocity > 3;

  return (
    <Link href={`/stories/${story.id}`} className="block group">
      <article className="bg-surface border border-border rounded-xl overflow-hidden hover:border-blue-500/30 hover:bg-surface-hover transition-all duration-200">
        {story.image_url && (
          <div className="h-40 overflow-hidden">
            <img
              src={story.image_url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <TopicBadge topic={story.topic} />
              {secondaryTopics.map((t) => (
                <span
                  key={t.topic}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-muted border border-border"
                >
                  {t.topic}
                </span>
              ))}
              <RegionDots regions={story.regions} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isRising && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-400">
                  <Flame className="w-3 h-3" />
                  Rising
                </span>
              )}
              <span className="text-xs text-muted whitespace-nowrap">
                {timeAgo(story.first_seen)}
              </span>
            </div>
          </div>

          <h2 className="font-serif text-lg font-semibold leading-snug mb-2 group-hover:text-blue-400 transition-colors">
            {title}
          </h2>

          {story.summary && (
            <p className="text-sm text-muted line-clamp-2 mb-3">
              {story.summary}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Newspaper className="w-3.5 h-3.5" />
              {story.source_count} sources
            </span>
            <span className="inline-flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              {story.country_count} countries
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              {story.region_count} {story.region_count === 1 ? "region" : "regions"}
            </span>
            <span>
              {story.article_count} {story.article_count === 1 ? "article" : "articles"}
            </span>
            {story.velocity > 0 && (
              <span className="inline-flex items-center gap-1 text-green-400">
                <TrendingUp className="w-3.5 h-3.5" />
                +{story.velocity}/2h
              </span>
            )}
          </div>

          {story.regions.length > 1 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted">
                Covered in: {story.regions.map((r) => REGION_LABELS[r]).join(", ")}
              </p>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
