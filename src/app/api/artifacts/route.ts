import { ZodError, z } from "zod";
import { badRequest, created, handleZodError, serverError } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import type {
  CreateArtifactRequest,
  CreateArtifactResponse,
  ListArtifactsResponse,
} from "@/lib/redesign-contract";
import { listArtifacts, createArtifact } from "@/services/redesign";
import { DomainInvariantError } from "@/services/redesign/errors";

export type { CreateArtifactRequest, CreateArtifactResponse, ListArtifactsResponse };

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

const createArtifactRequestSchema = z.object({
  parentType: artifactParentTypeSchema,
  learningModuleVersionId: z.string().min(1).nullable().optional(),
  topicVersionId: z.string().min(1).nullable().optional(),
  sessionId: z.string().min(1).nullable().optional(),
  assessmentId: z.string().min(1).nullable().optional(),
  artifactType: artifactTypeSchema,
  sourceType: artifactSourceTypeSchema,
  title: z.string().min(1),
  uri: z.string().min(1),
  filename: z.string().min(1).nullable().optional(),
  mimeType: z.string().min(1).nullable().optional(),
  generatorKey: z.string().min(1).nullable().optional(),
  generatedAt: z.string().datetime().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parentType = params.get("parentType");
    const artifacts = await listArtifacts(prisma, {
      parentType: parentType ? artifactParentTypeSchema.parse(parentType) : undefined,
      learningModuleVersionId: params.get("learningModuleVersionId") ?? undefined,
      topicVersionId: params.get("topicVersionId") ?? undefined,
      sessionId: params.get("sessionId") ?? undefined,
      assessmentId: params.get("assessmentId") ?? undefined,
      includeArchived: params.get("includeArchived") === "true",
    });

    return Response.json(
      { artifacts: artifacts.map(toArtifactDto) } satisfies ListArtifactsResponse,
    );
  } catch (error) {
    return handleArtifactError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createArtifactRequestSchema.parse(await request.json());
    const artifact = await createArtifact(prisma, {
      ...body,
      generatedAt: body.generatedAt ? new Date(body.generatedAt) : null,
    });
    return created(
      { artifact: toArtifactDto(artifact) } satisfies CreateArtifactResponse,
    );
  } catch (error) {
    return handleArtifactError(error);
  }
}

function toArtifactDto(artifact: {
  id: string;
  parentType: CreateArtifactRequest["parentType"];
  learningModuleVersionId: string | null;
  topicVersionId: string | null;
  sessionId: string | null;
  assessmentId: string | null;
  artifactType: CreateArtifactRequest["artifactType"];
  sourceType: CreateArtifactRequest["sourceType"];
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
  if (error instanceof DomainInvariantError) return badRequest(error.message);
  return serverError(error instanceof Error ? error.message : "Internal server error");
}
