import { auth } from "@/auth";

type InstructorLookupDb = {
  instructor: {
    upsert: (args: {
      where: { email: string };
      create: { email: string; name: string };
      update: Record<string, never>;
      select: { id: true; email: true; name: true };
    }) => Promise<{ id: string; email: string; name: string }>;
    findUnique: (args: {
      where: { email: string };
      select: { id: true; email: true; name: true };
    }) => Promise<{ id: string; email: string; name: string } | null>;
    findFirst?: (args: {
      where: { email: { equals: string; mode: "insensitive" } };
      select: { id: true; email: true; name: true };
    }) => Promise<{ id: string; email: string; name: string } | null>;
  };
};

export async function getAuthenticatedInstructor(db: InstructorLookupDb) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  return getOrCreateInstructor(db, email, session?.user?.name?.trim() || email);
}

export async function getOrCreateInstructor(db: InstructorLookupDb, email: string, name: string) {
  email = email.trim().toLowerCase();
  const select = { id: true, email: true, name: true } as const;
  // Existing seeded rows may retain mixed case; reuse them before a normalized insert.
  const existing = await db.instructor.findFirst?.({
    where: { email: { equals: email, mode: "insensitive" } },
    select,
  });
  if (existing) return existing;
  try {
    return await db.instructor.upsert({
      where: { email },
      create: { email, name },
      update: {},
      select,
    });
  } catch (error) {
    // An empty-update upsert can race another insert. Resolve the winner.
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
      throw error;
    }
    const instructor = await db.instructor.findUnique({ where: { email }, select });
    if (instructor) return instructor;
    throw error;
  }
}
