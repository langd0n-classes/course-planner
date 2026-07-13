import { auth } from "@/auth";

type InstructorLookupDb = {
  instructor: {
    findUnique: (args: {
      where: { email: string };
      select?: { id?: boolean; email?: boolean; name?: boolean };
    }) => Promise<{ id: string; email: string; name: string } | null>;
  };
};

export async function getAuthenticatedInstructor(db: InstructorLookupDb) {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return null;
  }

  return db.instructor.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
}
