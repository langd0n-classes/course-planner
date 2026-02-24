"use client";

type CoverageLevel = "introduced" | "practiced" | "assessed";

const LEVEL_STYLES: Record<CoverageLevel, string> = {
  introduced: "bg-yellow-100 text-yellow-800",
  practiced: "bg-blue-100 text-blue-800",
  assessed: "bg-green-100 text-green-800",
};

const LEVEL_ABBREV: Record<CoverageLevel, string> = {
  introduced: "I",
  practiced: "P",
  assessed: "A",
};

interface CoverageBadgeProps {
  level: CoverageLevel;
  onClick?: () => void;
  title?: string;
  size?: "sm" | "md";
}

export default function CoverageBadge({
  level,
  onClick,
  title,
  size = "sm",
}: CoverageBadgeProps) {
  const sizeClass = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";
  const base = `inline-block font-bold rounded ${LEVEL_STYLES[level]} ${sizeClass}`;

  if (onClick) {
    return (
      <button onClick={onClick} className={`${base} cursor-pointer`} title={title}>
        {LEVEL_ABBREV[level]}
      </button>
    );
  }

  return (
    <span className={base} title={title ?? level}>
      {LEVEL_ABBREV[level]}
    </span>
  );
}

export function CoverageLevelLabel({ level }: { level: CoverageLevel }) {
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${LEVEL_STYLES[level]}`}>
      {level}
    </span>
  );
}
