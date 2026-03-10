import type { Region } from "@/lib/types";
import { REGION_COLORS, REGION_LABELS } from "@/lib/utils";

export function RegionDots({ regions }: { regions: Region[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {regions.map((r) => (
        <span
          key={r}
          title={REGION_LABELS[r]}
          className={`w-2.5 h-2.5 rounded-full ${REGION_COLORS[r]}`}
        />
      ))}
    </div>
  );
}
