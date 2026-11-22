import { unexpectedRouteError } from "@/lib/route-errors";
import { readJsonBody } from "@/lib/request-json";
import { ZodError, z } from "zod";
import { badRequest, created, handleZodError, notFound, unauthorized } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
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
  learningModuleVersionId: z.string().uuid().nullable().optional(),
  topicVersionId: z.string().uuid().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  assessmentId: z.string().uuid().nullable().optional(),
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
    const instructor = await getAuthenticatedInstructor(prisma);
    if (!instructor) return unauthorized();

    const params = new URL(request.url).searchParams;
    const parentType = params.get("parentType");
    const artifacts = await listArtifacts(prisma, instructor.id, {
      parentType: parentType ? artifactParentTypeSchema.parse(parentType) : undefined,
      learningModuleVersionId: params.has("learningModuleVersionId") ? z.string().uuid().parse(params.get("learningModuleVersionId")) : undefined,
      topicVersionId: params.has("topicVersionId") ? z.string().uuid().parse(params.get("topicVersionId")) : undefined,
      sessionId: params.has("sessionId") ? z.string().uuid().parse(params.get("sessionId")) : undefined,
      assessmentId: params.has("assessmentId") ? z.string().uuid().parse(params.get("assessmentId")) : undefined,
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
    const instructor = await getAuthenticatedInstructor(prisma);
    if (!instructor) return unauthorized();

    const json = await readJsonBody(request);
    if (json.response) return json.response;
    const body = createArtifactRequestSchema.parse(json.data);
    const artifact = await createArtifact(prisma, {
      instructorId: instructor.id,
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
  if (error instanceof DomainInvariantError) {
    return error.message.endsWith("not found") ? notFound(error.message) : badRequest(error.message);
  }
  return unexpectedRouteError(error);
}
