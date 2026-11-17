import {
  findEffortSize,
  formatEffortRange,
  type EffortRange,
} from "@/lib/effort";
export default function EffortSummary({
  range,
  sizes = [],
}: {
  range: EffortRange | null;
  sizes?: (EffortRange & { label: string })[];
}) {
  const size = findEffortSize(sizes, range);
  return (
    <span className="block text-sm text-slate-600">
      {range
        ? `${size ? `${size.label} · ` : ""}${formatEffortRange(range)}`
        : "Not sized"}
    </span>
  );
}
