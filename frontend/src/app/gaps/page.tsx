import { getStories } from "@/lib/api";
import { StoryCard } from "@/components/StoryCard";
import { Eye } from "lucide-react";

export const revalidate = 300;

export default async function GapsPage() {
  // Show stories with high asymmetry: high significance but limited region count
  // Or stories prominent in some regions but not others
  const { stories } = await getStories({ limit: 50 });

  // Find asymmetric stories: those covered by multiple sources but concentrated in fewer regions
  const gapStories = stories.filter(
    (s) => s.source_count >= 2 && s.region_count <= 2 && s.significance >= 10
  );

  // Multi-region stories for comparison
  const globalStories = stories.filter(
    (s) => s.region_count >= 3
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-2 flex items-center gap-3">
          <Eye className="w-8 h-8 text-rose-400" />
          Coverage Gaps
        </h1>
        <p className="text-muted">
          Stories that are significant in some regions but absent from others.
          What you are not seeing may be as important as what you are.
        </p>
      </div>

      {/* Explanation */}
      <div className="bg-surface border border-rose-500/20 rounded-xl p-5 mb-8">
        <h2 className="font-semibold text-rose-400 mb-2">How gap detection works</h2>
        <p className="text-sm text-muted">
          We compare how stories are covered across four global regions. When a story receives
          significant coverage in one region but little or none in others, it appears here.
          This helps reveal blind spots in your typical media diet.
        </p>
      </div>

      {/* Region-concentrated stories */}
      {gapStories.length > 0 && (
        <section className="mb-10">
          <h2 className="font-serif text-xl font-semibold mb-4">
            Regional stories with limited global coverage
          </h2>
          <div className="space-y-4">
            {gapStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      {/* Global stories for contrast */}
      {globalStories.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold mb-4">
            Globally covered stories (3+ regions)
          </h2>
          <div className="space-y-4">
            {globalStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      {gapStories.length === 0 && globalStories.length === 0 && (
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-2">No coverage gap data yet.</p>
          <p className="text-sm">Coverage gap detection requires story clusters from the intelligence pipeline.</p>
        </div>
      )}
    </div>
  );
}
