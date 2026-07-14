"use client";

export default function PrototypeBanner() {
  return (
    <div
      role="status"
      aria-label="Prototype notice"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-300 px-3 py-1 text-xs text-amber-800 font-medium"
    >
      <span aria-hidden="true">⚠</span>
      Interaction prototype — mutations are local only and reset on reload
    </div>
  );
}
