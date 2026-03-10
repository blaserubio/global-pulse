import { TOPIC_COLORS } from "@/lib/utils";

export function TopicBadge({ topic }: { topic: string | null }) {
  if (!topic) return null;
  const colors = TOPIC_COLORS[topic] || "bg-gray-500/20 text-gray-300";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
      {topic}
    </span>
  );
}
