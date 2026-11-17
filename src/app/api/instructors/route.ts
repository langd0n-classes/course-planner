import prisma from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { retired } from "@/app/api/redesign-stub";

export async function GET() {
  const instructor = await getAuthenticatedInstructor(prisma);
  return instructor ? ok([instructor]) : unauthorized();
}

export async function POST() {
  return retired("Instructor identity is managed by sign-in.");
}
