import { createHash, randomUUID } from "node:crypto";
import {
  ZipFormatError,
  createZip,
  decodeText,
  encodeText,
  readZip,
  type ZipEntry,
} from "./package-zip";

export type PackageProfile = "course-planner-lossless" | "blackboard-compatible";

export type PackageScope =
  | { kind: "course"; courseId: string; termId?: string }
  | { kind: "learning-module"; termLearningModuleId: string };

export type PackageArtifact = {
  id: string;
  parentType: "learning_module_version" | "topic_version" | "session" | "assessment";
  learningModuleVersionId: string | null;
  topicVersionId: string | null;
  sessionId: string | null;
  assessmentId: string | null;
  artifactType: string;
  sourceType: "external_uri" | "uploaded_file" | "generated_file";
  title: string;
  uri: string;
  filename: string | null;
  mimeType: string | null;
  generatorKey: string | null;
  generatedAt: string | null;
  metadata: unknown;
  archivedAt: string | null;
};

export type CoursePackageGraph = {
  schemaVersion: "2026-07-12";
  course: Record<string, unknown>;
  learningModules: Array<Record<string, unknown>>;
  learningModuleVersions: Array<Record<string, unknown>>;
  topics: Array<Record<string, unknown>>;
  topicVersions: Array<Record<string, unknown>>;
  termLearningModules: Array<Record<string, unknown>>;
  terms: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  coverages: Array<Record<string, unknown>>;
  assessments: Array<Record<string, unknown>>;
  artifacts: PackageArtifact[];
};

export type PackageExportInput = {
  profile: PackageProfile;
  scope: PackageScope;
  graph: CoursePackageGraph;
  payloadResolver?: CoursePackagePayloadResolver;
  packageObjectId?: string;
  exportedAt?: string;
};

export type PackageInspection = {
  detectedProfile: PackageProfile | "common-cartridge" | "unknown";
  packageObjectId: string | null;
  revisionHash: string | null;
  schemaVersion: string | null;
  warnings: string[];
  entryNames: string[];
  metadataTitle: string | null;
  resourceCount: number;
};

export type PackageImportDecisions = {
  mode: "preview-only" | "create-independent-fork" | "merge-into-existing";
  targetCourseId?: string;
  allowLossyImport?: boolean;
};

export type ImportedCommonCartridgeModule = {
  title: string;
  items: Array<{
    identifier: string;
    title: string;
    resourceType: string | null;
    href: string | null;
  }>;
};

export type PackagePayloadSummary = {
  artifactId: string;
  filename: string | null;
  mimeType: string | null;
  path: string;
  sha256: string;
  size: number;
  sourceType: "uploaded_file" | "generated_file";
};

export type UnresolvedPackagePayload = {
  artifactId: string;
  title: string;
  reason: string;
};

export type PackageImportPreview = {
  sourceFormat: "course-planner-lossless" | "common-cartridge";
  isLossless: boolean;
  losslessApplyAllowed: boolean;
  packageObjectId: string | null;
  revisionHash: string | null;
  warnings: string[];
  unsupportedResources: Array<{ identifier: string; type: string | null; href: string | null }>;
  idempotencyKey: string | null;
  graph?: CoursePackageGraph;
  payloads?: PackagePayloadSummary[];
  unresolvedPayloads: UnresolvedPackagePayload[];
  commonCartridge?: {
    title: string | null;
    version: string | null;
    learningModules: ImportedCommonCartridgeModule[];
  };
};

export type PackageResult = {
  filename: string;
  bytes: Uint8Array;
  inspection: PackageInspection;
};

export type ResolvedExportPayload = {
  kind: "resolved";
  bytes: Uint8Array;
};

export type UnresolvedExportPayload = {
  kind: "unresolved";
  reason: string;
};

export type ResolvedImportPayload = PackagePayloadSummary & {
  bytes: Uint8Array;
};

export type RestoredPayloadResult = {
  artifactId: string;
  restoredUri?: string | null;
};

export interface CoursePackagePayloadResolver {
  resolvePayload(artifact: PackageArtifact): Promise<ResolvedExportPayload | UnresolvedExportPayload>;
  restorePayload?(payload: ResolvedImportPayload): Promise<RestoredPayloadResult>;
}

export class PackagePayloadUnavailableError extends Error {
  constructor(public readonly unresolvedPayloads: UnresolvedPackagePayload[]) {
    super(
      `Lossless package payloads were unavailable: ${unresolvedPayloads
        .map((payload) => payload.artifactId)
        .join(", ")}`,
    );
    this.name = "PackagePayloadUnavailableError";
  }
}

const LOSSLESS_METADATA_PATH = "course-planner/package.json";
const LOSSLESS_GRAPH_PATH = "course-planner/course-package.json";
const LOSSLESS_PAYLOAD_MANIFEST_PATH = "course-planner/payloads.json";
const LOSSLESS_PAYLOAD_PREFIX = "course-planner/payloads/";
const IMS_MANIFEST_PATH = "imsmanifest.xml";
const SCHEMA_VERSION = "2026-07-12";
const COMMON_CARTRIDGE_WEB_TYPES = new Set([
  "webcontent",
  "associatedcontent/imscc_xmlv1p1/learning-application-resource",
]);
const COMMON_CARTRIDGE_LINK_TYPES = new Set(["imswl_xmlv1p1"]);

type LosslessMetadata = {
  profile: PackageProfile;
  scope: PackageScope;
  schemaVersion: string;
  exportedAt: string;
  packageObjectId: string;
  revisionHash: string;
  title: string;
};

type PayloadManifestEntry = PackagePayloadSummary;

export class CoursePackageCodec {
  async exportPackage(input: PackageExportInput): Promise<PackageResult> {
    if (input.profile !== "course-planner-lossless") {
      throw new Error("Lane B implements lossless Course Planner export only; Blackboard export stays Phase C.");
    }

    const exportedAt = input.exportedAt ?? new Date().toISOString();
    const packageObjectId = input.packageObjectId ?? randomUUID();
    const normalizedGraph = normalizeGraph(input.graph);
    const revisionHash = sha256(JSON.stringify(normalizedGraph));
    const payloadBundle = await collectPayloadEntries(normalizedGraph.artifacts, input.payloadResolver);
    if (payloadBundle.unresolvedPayloads.length > 0) {
      throw new PackagePayloadUnavailableError(payloadBundle.unresolvedPayloads);
    }

    const metadata: LosslessMetadata = {
      profile: input.profile,
      scope: input.scope,
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      packageObjectId,
      revisionHash,
      title: deriveTitle(normalizedGraph),
    };

    const manifest = renderLosslessManifest(metadata.title, packageObjectId);
    const bytes = createZip([
      { name: IMS_MANIFEST_PATH, bytes: encodeText(manifest) },
      { name: LOSSLESS_METADATA_PATH, bytes: encodeText(JSON.stringify(metadata, null, 2)) },
      { name: LOSSLESS_GRAPH_PATH, bytes: encodeText(JSON.stringify(normalizedGraph, null, 2)) },
      {
        name: LOSSLESS_PAYLOAD_MANIFEST_PATH,
        bytes: encodeText(JSON.stringify(payloadBundle.manifest, null, 2)),
      },
      ...payloadBundle.entries,
    ]);

    return {
      filename: `${slugify(metadata.title)}.course-planner.zip`,
      bytes,
      inspection: await this.inspectPackage(bytes),
    };
  }

  async inspectPackage(bytes: Uint8Array): Promise<PackageInspection> {
    const entries = readZip(bytes);
    const entryNames = entries.map((entry) => entry.name).sort();
    const warnings: string[] = [];

    const metadataEntry = findEntry(entries, LOSSLESS_METADATA_PATH);
    if (metadataEntry) {
      const metadata = JSON.parse(decodeText(metadataEntry.bytes)) as Partial<LosslessMetadata>;
      return {
        detectedProfile: metadata.profile ?? "unknown",
        packageObjectId: metadata.packageObjectId ?? null,
        revisionHash: metadata.revisionHash ?? null,
        schemaVersion: metadata.schemaVersion ?? null,
        warnings,
        entryNames,
        metadataTitle: metadata.title ?? null,
        resourceCount: entries.length,
      };
    }

    const manifestEntry = findEntry(entries, IMS_MANIFEST_PATH);
    if (!manifestEntry) {
      return {
        detectedProfile: "unknown",
        packageObjectId: null,
        revisionHash: null,
        schemaVersion: null,
        warnings: ["Package does not contain imsmanifest.xml or course-planner metadata."],
        entryNames,
        metadataTitle: null,
        resourceCount: entries.length,
      };
    }

    const manifest = parseXml(decodeText(manifestEntry.bytes));
    const title =
      findFirstText(manifest, [
        "manifest",
        "metadata",
        "lomimscc:lom",
        "lomimscc:general",
        "lomimscc:title",
        "lomimscc:string",
      ]) ??
      findFirstText(manifest, ["manifest", "organizations", "organization", "title"]) ??
      null;
    const schemaVersion = findFirstText(manifest, ["manifest", "metadata", "schemaversion"]);
    return {
      detectedProfile: "common-cartridge",
      packageObjectId: null,
      revisionHash: null,
      schemaVersion,
      warnings,
      entryNames,
      metadataTitle: title,
      resourceCount: entries.length,
    };
  }

  async importPackage(
    bytes: Uint8Array,
    decisions: PackageImportDecisions,
  ): Promise<PackageImportPreview> {
    const inspection = await this.inspectPackage(bytes);
    const entries = readZip(bytes);

    if (inspection.detectedProfile === "course-planner-lossless") {
      const parsed = parseLosslessPackage(entries);
      const idempotencyKey = inspection.packageObjectId
        ? `${inspection.packageObjectId}:${parsed.revisionHash}`
        : parsed.revisionHash;
      const warnings = decisions.mode === "merge-into-existing"
        ? ["Merge mode is preview-only in Lane B; no revisions are overwritten."]
        : [];
      if (parsed.unresolvedPayloads.length > 0) {
        warnings.push("Lossless apply is blocked until every uploaded/generated payload is available and verified.");
      }

      return {
        sourceFormat: "course-planner-lossless",
        isLossless: parsed.unresolvedPayloads.length === 0,
        losslessApplyAllowed: parsed.unresolvedPayloads.length === 0,
        packageObjectId: inspection.packageObjectId,
        revisionHash: parsed.revisionHash,
        warnings,
        unsupportedResources: [],
        idempotencyKey,
        graph: parsed.graph,
        payloads: parsed.payloads,
        unresolvedPayloads: parsed.unresolvedPayloads,
      };
    }

    if (inspection.detectedProfile !== "common-cartridge") {
      throw new ZipFormatError("Unsupported package format");
    }

    const manifestEntry = findEntry(entries, IMS_MANIFEST_PATH);
    if (!manifestEntry) {
      throw new ZipFormatError("Common Cartridge package is missing imsmanifest.xml");
    }
    const parsed = parseCommonCartridge(entries, decodeText(manifestEntry.bytes));
    return {
      sourceFormat: "common-cartridge",
      isLossless: false,
      losslessApplyAllowed: false,
      packageObjectId: null,
      revisionHash: null,
      warnings: parsed.warnings,
      unsupportedResources: parsed.unsupportedResources,
      idempotencyKey: null,
      unresolvedPayloads: [],
      commonCartridge: {
        title: parsed.title,
        version: parsed.version,
        learningModules: parsed.learningModules,
      },
    };
  }

  async restorePayloads(
    bytes: Uint8Array,
    resolver: CoursePackagePayloadResolver,
  ) {
    if (!resolver.restorePayload) {
      throw new Error("Payload resolver does not implement restorePayload");
    }

    const parsed = parseLosslessPackage(readZip(bytes));
    if (parsed.unresolvedPayloads.length > 0) {
      throw new PackagePayloadUnavailableError(parsed.unresolvedPayloads);
    }

    const restored = [];
    for (const payload of parsed.resolvedPayloads) {
      restored.push(await resolver.restorePayload(payload));
    }

    return { restoredPayloads: restored };
  }
}

async function collectPayloadEntries(
  artifacts: PackageArtifact[],
  payloadResolver: CoursePackagePayloadResolver | undefined,
) {
  const manifest: PayloadManifestEntry[] = [];
  const entries: ZipEntry[] = [];
  const unresolvedPayloads: UnresolvedPackagePayload[] = [];

  for (const artifact of artifacts.filter((candidate) => candidate.sourceType !== "external_uri")) {
    const payloadSourceType = artifact.sourceType === "generated_file" ? "generated_file" : "uploaded_file";
    if (!payloadResolver) {
      unresolvedPayloads.push({
        artifactId: artifact.id,
        title: artifact.title,
        reason: "No payload resolver was provided for uploaded/generated Artifact bytes.",
      });
      continue;
    }

    const resolved = await payloadResolver.resolvePayload(artifact);
    if (resolved.kind === "unresolved") {
      unresolvedPayloads.push({
        artifactId: artifact.id,
        title: artifact.title,
        reason: resolved.reason,
      });
      continue;
    }

    const sha256Hash = sha256Bytes(resolved.bytes);
    const path = buildPayloadPath(artifact.id, sha256Hash, artifact.filename);
    manifest.push({
      artifactId: artifact.id,
      filename: artifact.filename ?? null,
      mimeType: artifact.mimeType ?? null,
      path,
      sha256: sha256Hash,
      size: resolved.bytes.length,
      sourceType: payloadSourceType,
    });
    entries.push({
      name: path,
      bytes: resolved.bytes,
    });
  }

  return {
    manifest: manifest.sort((left, right) => left.artifactId.localeCompare(right.artifactId)),
    entries: entries.sort((left, right) => left.name.localeCompare(right.name)),
    unresolvedPayloads,
  };
}

function parseLosslessPackage(entries: ZipEntry[]) {
  const metadataEntry = findEntry(entries, LOSSLESS_METADATA_PATH);
  const graphEntry = findEntry(entries, LOSSLESS_GRAPH_PATH);
  if (!metadataEntry || !graphEntry) {
    throw new ZipFormatError("Lossless Course Planner package is missing metadata or course-package.json");
  }

  const metadata = JSON.parse(decodeText(metadataEntry.bytes)) as Partial<LosslessMetadata>;
  const graph = normalizeGraph(JSON.parse(decodeText(graphEntry.bytes)) as CoursePackageGraph);
  const revisionHash = sha256(JSON.stringify(graph));
  if (metadata.revisionHash && metadata.revisionHash !== revisionHash) {
    throw new ZipFormatError("Lossless Course Planner package revision hash does not match course-package.json");
  }

  const payloadManifest = parsePayloadManifest(entries);
  const payloadEntryMap = new Map(payloadManifest.map((entry) => [entry.artifactId, entry]));
  const unresolvedPayloads: UnresolvedPackagePayload[] = [];
  const resolvedPayloads: ResolvedImportPayload[] = [];

  for (const artifact of graph.artifacts.filter((candidate) => candidate.sourceType !== "external_uri")) {
    const manifestEntry = payloadEntryMap.get(artifact.id);
    if (!manifestEntry) {
      unresolvedPayloads.push({
        artifactId: artifact.id,
        title: artifact.title,
        reason: "Payload manifest entry is missing for an uploaded/generated Artifact.",
      });
      continue;
    }

    const payloadFile = findEntry(entries, manifestEntry.path);
    if (!payloadFile) {
      unresolvedPayloads.push({
        artifactId: artifact.id,
        title: artifact.title,
        reason: `Payload bytes are missing at ${manifestEntry.path}.`,
      });
      continue;
    }

    const actualHash = sha256Bytes(payloadFile.bytes);
    if (actualHash !== manifestEntry.sha256) {
      unresolvedPayloads.push({
        artifactId: artifact.id,
        title: artifact.title,
        reason: `Payload hash mismatch for ${manifestEntry.path}.`,
      });
      continue;
    }
    if (payloadFile.bytes.length !== manifestEntry.size) {
      unresolvedPayloads.push({
        artifactId: artifact.id,
        title: artifact.title,
        reason: `Payload size mismatch for ${manifestEntry.path}.`,
      });
      continue;
    }

    resolvedPayloads.push({
      ...manifestEntry,
      bytes: payloadFile.bytes,
    });
  }

  return {
    metadata,
    graph,
    revisionHash,
    payloads: payloadManifest,
    resolvedPayloads,
    unresolvedPayloads,
  };
}

function parsePayloadManifest(entries: ZipEntry[]) {
  const manifestEntry = findEntry(entries, LOSSLESS_PAYLOAD_MANIFEST_PATH);
  if (!manifestEntry) return [];
  const parsed = JSON.parse(decodeText(manifestEntry.bytes)) as PayloadManifestEntry[];
  return [...parsed]
    .filter((entry) => entry.path.startsWith(LOSSLESS_PAYLOAD_PREFIX))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

function parseCommonCartridge(entries: ZipEntry[], xml: string) {
  const manifest = parseXml(xml);
  const resourcesNode = findNode(manifest, ["manifest", "resources"]);
  const resourceMap = new Map<string, { type: string | null; href: string | null }>();
  for (const resource of childrenByLocalName(resourcesNode, "resource")) {
    const identifier = resource.attributes.identifier;
    if (!identifier) continue;
    resourceMap.set(identifier, {
      type: resource.attributes.type ?? null,
      href: resource.attributes.href ?? null,
    });
  }

  const organizationNode = findNode(manifest, ["manifest", "organizations", "organization"]);
  const learningModules = childrenByLocalName(organizationNode, "item").map((moduleItem) => ({
    title: textFromChild(moduleItem, "title") ?? "Untitled import group",
    items: childrenByLocalName(moduleItem, "item").map((item) => {
      const identifier = item.attributes.identifier ?? randomUUID();
      const identifierRef = item.attributes.identifierref ?? "";
      const resource = resourceMap.get(identifierRef);
      return {
        identifier,
        title: textFromChild(item, "title") ?? "Untitled content item",
        resourceType: resource?.type ?? null,
        href: resource?.href ?? null,
      };
    }),
  }));

  const unsupportedResources: Array<{ identifier: string; type: string | null; href: string | null }> = [];
  const warnings: string[] = [];
  for (const [identifier, resource] of resourceMap.entries()) {
    const type = resource.type?.toLowerCase() ?? null;
    if (type && (COMMON_CARTRIDGE_WEB_TYPES.has(type) || COMMON_CARTRIDGE_LINK_TYPES.has(type))) {
      if (resource.href && !findEntry(entries, resource.href)) {
        warnings.push(`Resource ${identifier} references missing file ${resource.href}.`);
      }
      continue;
    }
    unsupportedResources.push({
      identifier,
      type: resource.type,
      href: resource.href,
    });
  }

  if (unsupportedResources.length > 0) {
    warnings.push("Unsupported Common Cartridge resources were reported before apply.");
  }

  return {
    title:
      findFirstText(manifest, [
        "manifest",
        "metadata",
        "lomimscc:lom",
        "lomimscc:general",
        "lomimscc:title",
        "lomimscc:string",
      ]) ??
      textFromChild(organizationNode, "title") ??
      null,
    version: findFirstText(manifest, ["manifest", "metadata", "schemaversion"]) ?? null,
    warnings,
    unsupportedResources,
    learningModules,
  };
}

function renderLosslessManifest(title: string, packageObjectId: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${escapeXml(packageObjectId)}" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
  <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.1.0</schemaversion>
    <lomimscc:lom xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource">
      <lomimscc:general>
        <lomimscc:title>
          <lomimscc:string>${escapeXml(title)}</lomimscc:string>
        </lomimscc:title>
      </lomimscc:general>
    </lomimscc:lom>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${escapeXml(title)}</title>
    </organization>
  </organizations>
  <resources />
</manifest>
`;
}

function deriveTitle(graph: CoursePackageGraph) {
  const courseTitle =
    typeof graph.course.title === "string" && graph.course.title.trim().length > 0
      ? graph.course.title
      : "course-planner-package";
  return courseTitle;
}

function buildPayloadPath(artifactId: string, sha256Hash: string, filename: string | null) {
  const safeName = sanitizeFilename(filename ?? "payload.bin");
  return `${LOSSLESS_PAYLOAD_PREFIX}${artifactId}/${sha256Hash}-${safeName}`;
}

function sanitizeFilename(value: string) {
  return value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "payload.bin";
}

function normalizeGraph(graph: CoursePackageGraph): CoursePackageGraph {
  return {
    ...graph,
    schemaVersion: SCHEMA_VERSION,
    learningModules: sortById(graph.learningModules),
    learningModuleVersions: sortById(graph.learningModuleVersions),
    topics: sortById(graph.topics),
    topicVersions: sortById(graph.topicVersions),
    termLearningModules: sortById(graph.termLearningModules),
    terms: sortById(graph.terms),
    sessions: sortById(graph.sessions),
    coverages: sortById(graph.coverages),
    assessments: sortById(graph.assessments),
    artifacts: [...graph.artifacts].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function sortById(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((left, right) =>
    String(left.id ?? "").localeCompare(String(right.id ?? "")),
  );
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Bytes(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function findEntry(entries: ZipEntry[], name: string) {
  return entries.find((entry) => entry.name === name);
}

type XmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
};

function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "#document", attributes: {}, children: [], text: "" };
  const stack = [root];
  const tokenRegex = /<[^>]+>|[^<]+/g;
  for (const token of xml.match(tokenRegex) ?? []) {
    if (token.startsWith("<?") || token.startsWith("<!")) continue;
    if (token.startsWith("</")) {
      stack.pop();
      continue;
    }
    if (token.startsWith("<")) {
      const selfClosing = token.endsWith("/>");
      const body = token.slice(1, token.length - (selfClosing ? 2 : 1)).trim();
      const nameMatch = body.match(/^([^\s/]+)/);
      if (!nameMatch) continue;
      const node: XmlNode = {
        name: nameMatch[1],
        attributes: parseAttributes(body.slice(nameMatch[1].length)),
        children: [],
        text: "",
      };
      stack[stack.length - 1]?.children.push(node);
      if (!selfClosing) stack.push(node);
      continue;
    }
    const text = token.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const current = stack[stack.length - 1];
    current.text = current.text ? `${current.text} ${text}` : text;
  }
  return root;
}

function parseAttributes(fragment: string) {
  const attributes: Record<string, string> = {};
  const attrRegex = /([^\s=]+)\s*=\s*"([^"]*)"/g;
  for (const match of fragment.matchAll(attrRegex)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function findNode(root: XmlNode, path: string[]) {
  let nodes = root.children;
  let current: XmlNode | undefined;
  for (const segment of path) {
    current = nodes.find((node) => node.name === segment);
    if (!current) return undefined;
    nodes = current.children;
  }
  return current;
}

function findFirstText(root: XmlNode, path: string[]) {
  return findNode(root, path)?.text ?? null;
}

function childrenByLocalName(node: XmlNode | undefined, localName: string) {
  if (!node) return [];
  return node.children.filter((child) => child.name.split(":").pop() === localName);
}

function textFromChild(node: XmlNode | undefined, localName: string) {
  return childrenByLocalName(node, localName)[0]?.text ?? null;
}
