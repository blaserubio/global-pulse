import { formatDistanceToNow, format } from 'date-fns';
import type { Region, FundingModel, EditorialLean, FactualRating } from './types';

export function timeAgo(date: string | null): string {
  if (!date) return 'Unknown';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | null): string {
  if (!date) return 'Unknown';
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

export const REGION_LABELS: Record<Region, string> = {
  americas: 'Americas',
  europe: 'Europe',
  asia_pacific: 'Asia-Pacific',
  mideast_africa: 'Middle East & Africa',
};

export const REGION_COLORS: Record<Region, string> = {
  americas: 'bg-blue-500',
  europe: 'bg-emerald-500',
  asia_pacific: 'bg-amber-500',
  mideast_africa: 'bg-rose-500',
};

export const REGION_TEXT_COLORS: Record<Region, string> = {
  americas: 'text-blue-400',
  europe: 'text-emerald-400',
  asia_pacific: 'text-amber-400',
  mideast_africa: 'text-rose-400',
};

export const LEAN_LABELS: Record<EditorialLean, string> = {
  left: 'Left',
  center_left: 'Center-Left',
  center: 'Center',
  center_right: 'Center-Right',
  right: 'Right',
  unknown: 'Unknown',
};

export const LEAN_COLORS: Record<EditorialLean, string> = {
  left: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  center_left: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  center: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  center_right: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  right: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  unknown: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export const FUNDING_LABELS: Record<FundingModel, string> = {
  state_funded: 'State-Funded',
  public: 'Public',
  private: 'Private',
  nonprofit: 'Nonprofit',
  unknown: 'Unknown',
};

export const FUNDING_ICONS: Record<FundingModel, string> = {
  state_funded: 'Landmark',
  public: 'Radio',
  private: 'Building2',
  nonprofit: 'Heart',
  unknown: 'HelpCircle',
};

export const FACTUAL_LABELS: Record<FactualRating, string> = {
  very_high: 'Very High',
  high: 'High',
  mostly_factual: 'Mostly Factual',
  mixed: 'Mixed',
  low: 'Low',
  unknown: 'Unknown',
};

export const FACTUAL_COLORS: Record<FactualRating, string> = {
  very_high: 'text-emerald-400',
  high: 'text-green-400',
  mostly_factual: 'text-yellow-400',
  mixed: 'text-orange-400',
  low: 'text-red-400',
  unknown: 'text-gray-400',
};

export const TOPIC_COLORS: Record<string, string> = {
  'Politics & Governance': 'bg-blue-500/20 text-blue-300',
  'Conflict & Security': 'bg-red-500/20 text-red-300',
  'Economy & Business': 'bg-emerald-500/20 text-emerald-300',
  'Science & Technology': 'bg-cyan-500/20 text-cyan-300',
  'Climate & Environment': 'bg-green-500/20 text-green-300',
  'Health': 'bg-pink-500/20 text-pink-300',
  'Culture & Society': 'bg-purple-500/20 text-purple-300',
  'Sports': 'bg-orange-500/20 text-orange-300',
  'Crime & Justice': 'bg-yellow-500/20 text-yellow-300',
  'Education': 'bg-indigo-500/20 text-indigo-300',
  'Human Rights': 'bg-rose-500/20 text-rose-300',
  'Diplomacy & International Relations': 'bg-sky-500/20 text-sky-300',
};

export function countryFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
