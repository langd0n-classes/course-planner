import {
  assertArtifactParent,
  assertArtifactUri,
  type ArtifactParentFields,
  type ArtifactSourceType,
} from "./invariants";
import { DomainInvariantError } from "./errors";
import type { RedesignDb, RedesignTx } from "./types";

export type CreateArtifactInput = ArtifactParentFields & {
  artifactType:
    | "notebook"
    | "handout"
    | "slides"
    | "instructions"
    | "dataset"
    | "reading"
    | "video"
    | "link"
    | "ta_key"
    | "other";
  sourceType: ArtifactSourceType;
  title: string;
  uri: string;
  filename?: string | null;
  mimeType?: string | null;
  generatorKey?: string | null;
  generatedAt?: Date | null;
  metadata?: unknown;
};

export type ArtifactRecord = {
  id: string;
  parentType: CreateArtifactInput["parentType"];
  learningModuleVersionId: string | null;
  topicVersionId: string | null;
  sessionId: string | null;
  assessmentId: string | null;
  artifactType: CreateArtifactInput["artifactType"];
  sourceType: CreateArtifactInput["sourceType"];
  title: string;
  uri: string;
  filename: string | null;
  mimeType: string | null;
  generatorKey: string | null;
  generatedAt: Date | null;
  metadata: unknown;
  archivedAt: Date | null;
};

export async function createArtifact(db: RedesignDb, input: CreateArtifactInput) {
  assertArtifactParent(input);
  assertArtifactUri(input.sourceType, input.uri);

  return db.$transaction(async (tx) => {
    await assertArtifactParentWritable(tx, input);

    return tx.artifact.create({
      data: {
        parentType: input.parentType,
        learningModuleVersionId: input.learningModuleVersionId ?? null,
        topicVersionId: input.topicVersionId ?? null,
        sessionId: input.sessionId ?? null,
        assessmentId: input.assessmentId ?? null,
        artifactType: input.artifactType,
        sourceType: input.sourceType,
        title: input.title,
        uri: input.uri,
        filename: input.filename ?? null,
        mimeType: input.mimeType ?? null,
        generatorKey: input.generatorKey ?? null,
        generatedAt: input.generatedAt ?? null,
        metadata: input.metadata,
      },
    });
  }) as Promise<ArtifactRecord>;
}

export async function listArtifacts(
  db: RedesignDb,
  filters: {
    parentType?: CreateArtifactInput["parentType"];
    learningModuleVersionId?: string;
    topicVersionId?: string;
    sessionId?: string;
    assessmentId?: string;
    includeArchived?: boolean;
  } = {},
) {
  return db.$transaction((tx) =>
    tx.artifact.findMany({
      where: {
        parentType: filters.parentType,
        learningModuleVersionId: filters.learningModuleVersionId,
        topicVersionId: filters.topicVersionId,
        sessionId: filters.sessionId,
        assessmentId: filters.assessmentId,
        ...(filters.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ) as Promise<ArtifactRecord[]>;
}

export async function getArtifact(tx: RedesignTx, artifactId: string) {
  return tx.artifact.findUnique({ where: { id: artifactId } }) as Promise<ArtifactRecord | null>;
}

export async function updateArtifact(
  db: RedesignDb,
  artifactId: string,
  patch: Partial<CreateArtifactInput> & { archivedAt?: Date | null },
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.artifact.findUnique({ where: { id: artifactId } });
    if (!existing) {
      throw new DomainInvariantError("Artifact not found");
    }

    const merged = {
      parentType: patch.parentType ?? existing.parentType,
      learningModuleVersionId:
        patch.learningModuleVersionId === undefined
          ? existing.learningModuleVersionId
          : patch.learningModuleVersionId,
      topicVersionId:
        patch.topicVersionId === undefined ? existing.topicVersionId : patch.topicVersionId,
      sessionId: patch.sessionId === undefined ? existing.sessionId : patch.sessionId,
      assessmentId:
        patch.assessmentId === undefined ? existing.assessmentId : patch.assessmentId,
      sourceType: patch.sourceType ?? existing.sourceType,
      uri: patch.uri ?? existing.uri,
    };

    assertArtifactParent(merged);
    assertArtifactUri(merged.sourceType, merged.uri);
    await assertArtifactParentWritable(tx, merged);

    return tx.artifact.update({
      where: { id: artifactId },
      data: withoutUndefined({
        parentType: patch.parentType,
        learningModuleVersionId: patch.learningModuleVersionId,
        topicVersionId: patch.topicVersionId,
        sessionId: patch.sessionId,
        assessmentId: patch.assessmentId,
        artifactType: patch.artifactType,
        sourceType: patch.sourceType,
        title: patch.title,
        uri: patch.uri,
        filename: patch.filename,
        mimeType: patch.mimeType,
        generatorKey: patch.generatorKey,
        generatedAt: patch.generatedAt,
        metadata: patch.metadata,
        archivedAt: patch.archivedAt,
      }),
    });
  }) as Promise<ArtifactRecord>;
}

export async function archiveArtifact(db: RedesignDb, artifactId: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.artifact.findUnique({ where: { id: artifactId } });
    if (!existing) {
      throw new DomainInvariantError("Artifact not found");
    }

    await assertArtifactParentWritable(tx, existing);

    if (existing.archivedAt) return existing as ArtifactRecord;
    return tx.artifact.update({
      where: { id: artifactId },
      data: { archivedAt: new Date() },
    }) as Promise<ArtifactRecord>;
  });
}

async function assertArtifactParentWritable(
  tx: RedesignTx,
  input: Pick<
    CreateArtifactInput,
    "parentType" | "learningModuleVersionId" | "topicVersionId" | "sessionId" | "assessmentId"
  >,
) {
  switch (input.parentType) {
    case "session": {
      const session = await tx.session.findUnique({
        where: { id: input.sessionId },
        include: { term: { select: { status: true } } },
      });
      if (!session) throw new DomainInvariantError("Artifact Session parent not found");
      if (session.term.status === "closed") {
        throw new DomainInvariantError("Closed Terms are read-only");
      }
      return;
    }
    case "assessment": {
      const assessment = await tx.assessment.findUnique({
        where: { id: input.assessmentId },
        include: { term: { select: { status: true } } },
      });
      if (!assessment) throw new DomainInvariantError("Artifact Assessment parent not found");
      if (assessment.term.status === "closed") {
        throw new DomainInvariantError("Closed Terms are read-only");
      }
      return;
    }
    case "learning_module_version": {
      const version = await tx.learningModuleVersion.findUnique({
        where: { id: input.learningModuleVersionId },
        select: { id: true },
      });
      if (!version) throw new DomainInvariantError("Artifact Learning Module Version parent not found");
      return;
    }
    case "topic_version": {
      const version = await tx.topicVersion.findUnique({
        where: { id: input.topicVersionId },
        select: { id: true },
      });
      if (!version) throw new DomainInvariantError("Artifact Topic Version parent not found");
    }
  }
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
