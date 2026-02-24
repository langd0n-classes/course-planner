"use client";

interface LoadingSkeletonProps {
  lines?: number;
}

export default function LoadingSkeleton({ lines = 4 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 w-full rounded bg-gray-200/70 animate-pulse"
        />
      ))}
    </div>
  );
}
