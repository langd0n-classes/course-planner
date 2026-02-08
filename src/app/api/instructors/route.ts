import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createInstructorSchema } from "@/lib/schemas";
import { ok, created, badRequest, handleZodError } from "@/lib/api-helpers";

export async function GET() {
  const instructors = await prisma.instructor.findMany({
    orderBy: { name: "asc" },
  });
  return ok(instructors);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createInstructorSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const existing = await prisma.instructor.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return badRequest("Email already exists");

  const instructor = await prisma.instructor.create({ data: parsed.data });
  return created(instructor);
}
