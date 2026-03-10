import type { Source } from "@/lib/types";
import { LEAN_LABELS, LEAN_COLORS, FUNDING_LABELS, FACTUAL_LABELS, FACTUAL_COLORS } from "@/lib/utils";
import { Landmark, Radio, Building2, Heart, HelpCircle, Shield } from "lucide-react";

const fundingIcons = {
  state_funded: Landmark,
  public: Radio,
  private: Building2,
  nonprofit: Heart,
  unknown: HelpCircle,
};

export function LeanBadge({ lean }: { lean: Source["editorial_lean"] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${LEAN_COLORS[lean]}`}>
      {LEAN_LABELS[lean]}
    </span>
  );
}

export function FundingBadge({ model }: { model: Source["funding_model"] }) {
  const Icon = fundingIcons[model] || HelpCircle;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title={`Funding: ${FUNDING_LABELS[model]}`}>
      <Icon className="w-3.5 h-3.5" />
      {FUNDING_LABELS[model]}
    </span>
  );
}

export function FactualBadge({ rating }: { rating: Source["factual_rating"] }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${FACTUAL_COLORS[rating]}`} title={`Factual rating: ${FACTUAL_LABELS[rating]}`}>
      <Shield className="w-3.5 h-3.5" />
      {FACTUAL_LABELS[rating]}
    </span>
  );
}

export function SourceBadges({ source }: { source: Source }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LeanBadge lean={source.editorial_lean} />
      <FundingBadge model={source.funding_model} />
      <FactualBadge rating={source.factual_rating} />
    </div>
  );
}
