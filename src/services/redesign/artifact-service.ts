import {
  assertArtifactParent,
  assertArtifactUri,
  type ArtifactParentFields,
  type ArtifactSourceType,
} from "./invariants";
import type { RedesignDb } from "./types";

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
  metadata?: unknown;
};

export async function createArtifact(db: RedesignDb, input: CreateArtifactInput) {
  assertArtifactParent(input);
  assertArtifactUri(input.sourceType, input.uri);

  return db.$transaction((tx) =>
    tx.artifact.create({
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
        metadata: input.metadata,
      },
    }),
  );
}
