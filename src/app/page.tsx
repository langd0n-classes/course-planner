// Quarantined for the Phase A.1 redesign refreeze: the previous homepage
// queried prisma.term with the removed Module/Instructor-on-Term shape.
// This is a minimal workspace shell so the redesign branch builds; Lane C
// owns the real Plan/Run workspace UI against the frozen contract in
// src/lib/redesign-contract.ts.

export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Course Planner</h1>
      <p className="text-gray-600 mb-6">
        The redesign is in progress. This workspace shell is a placeholder
        until Phase B implements the Course/LearningModule/Topic UI against
        the frozen Phase A contract.
      </p>
    </div>
  );
}
