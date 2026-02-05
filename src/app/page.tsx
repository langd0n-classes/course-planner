import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let terms: { id: string; code: string; name: string; courseCode: string; instructor: { name: string } }[] = [];
  let instructorCount = 0;

  try {
    terms = await prisma.term.findMany({
      include: { instructor: true },
      orderBy: { startDate: "desc" },
      take: 5,
    }) as typeof terms;
    instructorCount = await prisma.instructor.count();
  } catch {
    // DB may not be connected yet
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Course Planner</h1>
      <p className="text-gray-600 mb-6">
        Plan courses, track skill coverage, and manage assessments.
      </p>

      {instructorCount === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
          <p className="text-yellow-800">
            No data found. Run <code className="bg-yellow-100 px-1 rounded">npm run db:seed</code> to populate demo data.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/terms"
          className="bg-white rounded-lg border p-4 hover:border-blue-300 transition-colors"
        >
          <h2 className="font-semibold mb-1">Terms</h2>
          <p className="text-sm text-gray-500">
            {terms.length > 0
              ? `${terms.length} recent term(s)`
              : "Manage semesters and quarters"}
          </p>
        </Link>
        <Link
          href="/skills"
          className="bg-white rounded-lg border p-4 hover:border-blue-300 transition-colors"
        >
          <h2 className="font-semibold mb-1">Skills</h2>
          <p className="text-sm text-gray-500">
            Browse and manage competencies
          </p>
        </Link>
        <div className="bg-white rounded-lg border p-4 opacity-60">
          <h2 className="font-semibold mb-1">AI Assistant</h2>
          <p className="text-sm text-gray-500">Coming soon</p>
        </div>
      </div>

      {terms.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Terms</h2>
          <div className="bg-white rounded-lg border divide-y">
            {terms.map((t) => (
              <Link
                key={t.id}
                href={`/terms/${t.id}`}
                className="block px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-gray-500 ml-2 text-sm">
                      {t.courseCode} ({t.code})
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {t.instructor.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
