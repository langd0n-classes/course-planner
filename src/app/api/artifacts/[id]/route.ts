import { ZodError, z } from "zod";
import { badRequest, handleZodError, notFound, ok, serverError } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import type {
  DeleteArtifactResponse,
  GetArtifactResponse,
  UpdateArtifactRequest,
  UpdateArtifactResponse,
} from "@/lib/redesign-contract";
import { archiveArtifact, hardRemoveArtifact, previewHardRemoval, updateArtifact } from "@/services/redesign";
import { DomainInvariantError } from "@/services/redesign/errors";

export type {
  DeleteArtifactResponse,
  GetArtifactResponse,
  UpdateArtifactRequest,
  UpdateArtifactResponse,
};

const artifactParentTypeSchema = z.enum([
  "learning_module_version",
  "topic_version",
  "session",
  "assessment",
]);

const artifactTypeSchema = z.enum([
  "notebook",
  "handout",
  "slides",
  "instructions",
  "dataset",
  "reading",
  "video",
  "link",
  "ta_key",
  "other",
]);

const artifactSourceTypeSchema = z.enum(["external_uri", "uploaded_file", "generated_file"]);

const updateArtifactRequestSchema = z.object({
  parentType: artifactParentTypeSchema.optional(),
  learningModuleVersionId: z.string().min(1).nullable().optional(),
  topicVersionId: z.string().min(1).nullable().optional(),
  sessionId: z.string().min(1).nullable().optional(),
  assessmentId: z.string().min(1).nullable().optional(),
  artifactType: artifactTypeSchema.optional(),
  sourceType: artifactSourceTypeSchema.optional(),
  title: z.string().min(1).optional(),
  uri: z.string().min(1).optional(),
  filename: z.string().min(1).nullable().optional(),
  mimeType: z.string().min(1).nullable().optional(),
  generatorKey: z.string().min(1).nullable().optional(),
  generatedAt: z.string().datetime().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const artifact = await prisma.artifact.findUnique({ where: { id } });
    if (!artifact) return notFound("Artifact not found");
    return ok({ artifact: toArtifactDto(artifact) } satisfies GetArtifactResponse);
  } catch (error) {
    return handleArtifactError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const body = updateArtifactRequestSchema.parse(await request.json());
    const artifact = await updateArtifact(prisma, id, {
      ...body,
      generatedAt:
        body.generatedAt === undefined
          ? undefined
          : body.generatedAt
            ? new Date(body.generatedAt)
            : null,
      archivedAt: body.archivedAt === undefined ? undefined : body.archivedAt ? new Date(body.archivedAt) : null,
    });
    return ok({ artifact: toArtifactDto(artifact) } satisfies UpdateArtifactResponse);
  } catch (error) {
    return handleArtifactError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "archive";

    if (mode === "hard-preview") {
      const preview = await previewHardRemoval(prisma, "artifact", id);
      return ok({
        kind: "hard_removal_preview",
        artifactId: id,
        canRemove: preview.canRemove,
        blockers: preview.blockers,
      } satisfies DeleteArtifactResponse);
    }

    if (mode === "hard-apply") {
      const confirmTitle = url.searchParams.get("confirmTitle");
      if (!confirmTitle) {
        return badRequest("Hard removal requires confirmTitle");
      }
      const removed = await hardRemoveArtifact(prisma, id, confirmTitle);
      return ok({
        kind: "hard_removed",
        artifactId: removed.artifactId,
        audit: {
          removedAt: removed.audit.removedAt.toISOString(),
          summary: removed.audit.summary,
        },
      } satisfies DeleteArtifactResponse);
    }

    const artifact = await archiveArtifact(prisma, id);
    return ok({
      kind: "archived",
      artifact: toArtifactDto(artifact),
    } satisfies DeleteArtifactResponse);
  } catch (error) {
    return handleArtifactError(error);
  }
}

function toArtifactDto(artifact: {
  id: string;
  parentType: NonNullable<UpdateArtifactRequest["parentType"]>;
  learningModuleVersionId: string | null;
  topicVersionId: string | null;
  sessionId: string | null;
  assessmentId: string | null;
  artifactType: NonNullable<UpdateArtifactRequest["artifactType"]>;
  sourceType: NonNullable<UpdateArtifactRequest["sourceType"]>;
  title: string;
  uri: string;
  filename: string | null;
  mimeType: string | null;
  generatorKey?: string | null;
  generatedAt?: Date | null;
  metadata?: unknown;
  archivedAt: Date | null;
}) {
  return {
    id: artifact.id,
    parentType: artifact.parentType,
    learningModuleVersionId: artifact.learningModuleVersionId,
    topicVersionId: artifact.topicVersionId,
    sessionId: artifact.sessionId,
    assessmentId: artifact.assessmentId,
    artifactType: artifact.artifactType,
    sourceType: artifact.sourceType,
    title: artifact.title,
    uri: artifact.uri,
    filename: artifact.filename,
    mimeType: artifact.mimeType,
    generatorKey: artifact.generatorKey ?? null,
    generatedAt: artifact.generatedAt?.toISOString() ?? null,
    metadata: artifact.metadata ?? null,
    archivedAt: artifact.archivedAt?.toISOString() ?? null,
  };
}

function handleArtifactError(error: unknown) {
  if (error instanceof ZodError) return handleZodError(error);
  if (error instanceof DomainInvariantError) {
    if (error.message === "Artifact not found") return notFound(error.message);
    return badRequest(error.message);
  }
  return serverError(error instanceof Error ? error.message : "Internal server error");
}
