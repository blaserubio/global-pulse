import type { Article } from "@/lib/types";
import { LeanBadge, FundingBadge, FactualBadge } from "./SourceBadges";
import { timeAgo, countryFlag } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export function ArticleCard({ article }: { article: Article }) {
  const s = article.source;

  return (
    <article className="bg-surface border border-border rounded-lg p-4 hover:border-blue-500/20 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base" title={s.country_code}>
          {countryFlag(s.country_code)}
        </span>
        <span className="text-sm font-medium">{s.name}</span>
        <span className="text-xs text-muted ml-auto">{timeAgo(article.published_at)}</span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group"
      >
        <h3 className="font-serif text-base font-medium leading-snug mb-2 group-hover:text-blue-400 transition-colors">
          {article.title}
          <ExternalLink className="w-3 h-3 inline ml-1.5 opacity-0 group-hover:opacity-50 transition-opacity" />
        </h3>
      </a>

      {article.author && (
        <p className="text-xs text-muted mb-2">By {article.author}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <LeanBadge lean={s.editorial_lean} />
        <FundingBadge model={s.funding_model} />
        <FactualBadge rating={s.factual_rating} />
      </div>
    </article>
  );
}
