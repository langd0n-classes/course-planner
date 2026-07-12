import { DomainInvariantError } from "./errors";

export type ArtifactParentType =
  | "learning_module_version"
  | "topic_version"
  | "session"
  | "assessment";

export type ArtifactParentFields = {
  parentType: ArtifactParentType;
  learningModuleVersionId?: string | null;
  topicVersionId?: string | null;
  sessionId?: string | null;
  assessmentId?: string | null;
};

export type ArtifactSourceType =
  | "external_uri"
  | "uploaded_file"
  | "generated_file";

export function assertArtifactParent(input: ArtifactParentFields) {
  const parentFields = {
    learning_module_version: input.learningModuleVersionId,
    topic_version: input.topicVersionId,
    session: input.sessionId,
    assessment: input.assessmentId,
  } satisfies Record<ArtifactParentType, string | null | undefined>;

  const setParents = Object.entries(parentFields).filter(([, value]) => Boolean(value));
  if (setParents.length !== 1) {
    throw new DomainInvariantError("Artifact must have exactly one parent");
  }

  if (setParents[0]?.[0] !== input.parentType) {
    throw new DomainInvariantError("Artifact parent foreign key must agree with parentType");
  }
}

export function assertArtifactUri(sourceType: ArtifactSourceType, uri: string) {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new DomainInvariantError("Artifact uri must be an absolute URI");
  }

  const externalSchemes = new Set(["https:", "http:", "gs:", "s3:"]);
  const durableFileSchemes = new Set(["s3:", "gs:", "r2:", "az:"]);

  if (sourceType === "external_uri" && !externalSchemes.has(parsed.protocol)) {
    throw new DomainInvariantError("External artifacts must use an allowed external URI scheme");
  }

  if (sourceType !== "external_uri" && !durableFileSchemes.has(parsed.protocol)) {
    throw new DomainInvariantError("Uploaded/generated artifacts must use durable object-storage URIs");
  }
}

export function assertSameIdentityVersion(
  identityId: string,
  versionIdentityId: string,
  label: string,
) {
  if (identityId !== versionIdentityId) {
    throw new DomainInvariantError(`${label} currentVersionId must refer to the same identity`);
  }
}

export function assertSameCourse(leftCourseId: string, rightCourseId: string, label: string) {
  if (leftCourseId !== rightCourseId) {
    throw new DomainInvariantError(`${label} cannot cross Course boundaries`);
  }
}

export function assertAcyclicTopicPrerequisite(
  topicId: string,
  prerequisiteTopicId: string,
  edges: Array<{ topicId: string; prerequisiteTopicId: string }>,
) {
  if (topicId === prerequisiteTopicId) {
    throw new DomainInvariantError("A Topic cannot be its own prerequisite");
  }

  const stack = [prerequisiteTopicId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === topicId) {
      throw new DomainInvariantError("Topic prerequisite cycle detected");
    }
    seen.add(current);
    for (const edge of edges) {
      if (edge.topicId === current) stack.push(edge.prerequisiteTopicId);
    }
  }
}
