"use client";

// v2.1 §9.2: editing an active term's curriculum advances the delivered
// pointer (a new immutable revision) and must always show this warning so
// the instructor never mistakes "editing delivery" for "editing the
// master design curriculum" (which shows no banner and touches no term).

export default function DeliveredEditBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 mb-4"
    >
      <span aria-hidden className="mt-0.5">
        ⚠
      </span>
      <div>
        <p className="font-medium">You are changing the delivered version of this term.</p>
        <p className="text-amber-800">
          This creates a new immutable revision and updates what this term actually delivered. The planned
          curriculum for this term does not change, and next term&apos;s design is unaffected.
        </p>
      </div>
    </div>
  );
}
