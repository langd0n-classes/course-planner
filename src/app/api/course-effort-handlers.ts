import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  badRequest,
  created,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import {
  courseEffortSizeSchema,
  courseEffortPartKindSchema,
  reorderCourseEffortSchema,
} from "@/lib/redesign-schemas";
import {
  toCourseEffortSizeDto,
  toCourseEffortPartKindDto,
} from "@/lib/redesign-serializers";
import {
  createCourseEffort,
  updateCourseEffort,
  listCourseEffort,
  deleteCourseEffort,
  reorderCourseEffort,
  type CourseEffortKind,
} from "@/services/redesign/effort-service";
import { DomainInvariantError } from "@/services/redesign/errors";

type Context = { params: Promise<{ id: string; entryId?: string }> };
export function courseEffortHandlers(kind: CourseEffortKind) {
  const schema =
    kind === "sizes" ? courseEffortSizeSchema : courseEffortPartKindSchema;
  const serialize =
    kind === "sizes" ? toCourseEffortSizeDto : toCourseEffortPartKindDto;
  function failure(error: unknown) {
    if (error instanceof DomainInvariantError)
      return error.message.endsWith("not found")
        ? notFound(error.message)
        : badRequest(error.message);
    throw error;
  }
  return {
    GET: async (_request: NextRequest, context: Context) => {
      const { id } = await context.params;
      const instructor = await getAuthenticatedInstructor(prisma);
      if (!instructor) return unauthorized();
      try {
        return ok({
          entries: (
            await listCourseEffort(prisma, instructor.id, id, kind)
          ).map(serialize),
        });
      } catch (error) {
        return failure(error);
      }
    },
    POST: async (request: NextRequest, context: Context) => {
      const { id } = await context.params;
      const instructor = await getAuthenticatedInstructor(prisma);
      if (!instructor) return unauthorized();
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success)
        return badRequest(
          "Invalid request",
          parsed.error.flatten().fieldErrors,
        );
      try {
        return created({
          entry: serialize(
            await createCourseEffort(
              prisma,
              instructor.id,
              id,
              kind,
              parsed.data,
            ),
          ),
        });
      } catch (error) {
        return failure(error);
      }
    },
    PATCH: async (request: NextRequest, context: Context) => {
      const { id, entryId } = await context.params;
      const instructor = await getAuthenticatedInstructor(prisma);
      if (!instructor) return unauthorized();
      const parsed = schema.safeParse(await request.json());
      if (!parsed.success)
        return badRequest(
          "Invalid request",
          parsed.error.flatten().fieldErrors,
        );
      try {
        return ok({
          entry: serialize(
            await updateCourseEffort(
              prisma,
              instructor.id,
              id,
              kind,
              entryId!,
              parsed.data,
            ),
          ),
        });
      } catch (error) {
        return failure(error);
      }
    },
    DELETE: async (_request: NextRequest, context: Context) => {
      const { id, entryId } = await context.params;
      const instructor = await getAuthenticatedInstructor(prisma);
      if (!instructor) return unauthorized();
      try {
        await deleteCourseEffort(prisma, instructor.id, id, kind, entryId!);
        return ok({ deleted: true });
      } catch (error) {
        return failure(error);
      }
    },
    PUT: async (request: NextRequest, context: Context) => {
      const { id } = await context.params;
      const instructor = await getAuthenticatedInstructor(prisma);
      if (!instructor) return unauthorized();
      const parsed = reorderCourseEffortSchema.safeParse(await request.json());
      if (!parsed.success)
        return badRequest(
          "Invalid request",
          parsed.error.flatten().fieldErrors,
        );
      try {
        return ok({
          entries: (
            await reorderCourseEffort(
              prisma,
              instructor.id,
              id,
              kind,
              parsed.data.ids,
            )
          ).map(serialize),
        });
      } catch (error) {
        return failure(error);
      }
    },
  };
}
