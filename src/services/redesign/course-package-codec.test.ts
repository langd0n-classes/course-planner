import { describe, expect, it } from "vitest";
import {
  CoursePackageCodec,
  type CoursePackageGraph,
} from "./course-package-codec";
import { createZip, encodeText } from "./package-zip";
import { SampleSyllabusImportService } from "./syllabus-import-service";

const codec = new CoursePackageCodec();

const sampleGraph: CoursePackageGraph = {
  schemaVersion: "2026-07-12",
  course: {
    id: "course-1",
    instructorId: "instructor-1",
    shortId: "042",
    title: "Data Science Foundations",
    number: "DS 1XX",
    archivedAt: null,
  },
  learningModules: [
    {
      id: "lm-1",
      courseId: "course-1",
      stableCode: "LM-1",
      currentVersionId: "lmv-2",
      archivedAt: null,
    },
  ],
  learningModuleVersions: [
    {
      id: "lmv-1",
      learningModuleId: "lm-1",
      revision: 1,
      title: "Probability",
      studentDescription: "Intro probability",
      topics: [{ topicVersionId: "tv-1", sequence: 1 }],
    },
    {
      id: "lmv-2",
      learningModuleId: "lm-1",
      revision: 2,
      title: "Probability",
      studentDescription: "Intro probability revised",
      topics: [
        { topicVersionId: "tv-1", sequence: 1 },
        { topicVersionId: "tv-2", sequence: 2 },
      ],
    },
  ],
  topics: [
    {
      id: "topic-1",
      courseId: "course-1",
      learningModuleId: "lm-1",
      stableCode: "T-1",
      currentVersionId: "tv-1",
      archivedAt: null,
    },
    {
      id: "topic-2",
      courseId: "course-1",
      learningModuleId: "lm-1",
      stableCode: "T-2",
      currentVersionId: "tv-2",
      archivedAt: null,
    },
  ],
  topicVersions: [
    {
      id: "tv-1",
      topicId: "topic-1",
      revision: 1,
      title: "Probability 1",
      description: "Foundations",
      publishedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "tv-2",
      topicId: "topic-2",
      revision: 1,
      title: "Probability 2",
      description: "Extensions",
      publishedAt: "2026-01-02T00:00:00.000Z",
    },
  ],
  termLearningModules: [
    {
      id: "tlm-1",
      termId: "term-1",
      learningModuleId: "lm-1",
      learningModuleVersionId: "lmv-1",
      deliveredLearningModuleVersionId: "lmv-2",
      sequence: 1,
    },
  ],
  terms: [
    {
      id: "term-1",
      courseId: "course-1",
      institutionId: "institution-1",
      academicCalendarId: "calendar-1",
      code: "S26",
      name: "Spring 2026",
      status: "active",
    },
  ],
  sessions: [
    {
      id: "session-1",
      termId: "term-1",
      termLearningModuleId: "tlm-1",
      sequence: 1,
      code: "L01",
      title: "Probability workshop",
    },
  ],
  coverages: [
    {
      id: "coverage-1",
      sessionId: "session-1",
      topicVersionId: "tv-1",
      level: "introduced",
    },
  ],
  assessments: [
    {
      id: "assessment-1",
      termId: "term-1",
      code: "A1",
      title: "Probability quiz",
      assessmentType: "quiz",
      topicVersionIds: ["tv-1"],
    },
  ],
  artifacts: [
    {
      id: "artifact-1",
      parentType: "session",
      learningModuleVersionId: null,
      topicVersionId: null,
      sessionId: "session-1",
      assessmentId: null,
      artifactType: "slides",
      sourceType: "generated_file",
      title: "Probability slides",
      uri: "s3://planner/generated/probability-slides.pdf",
      filename: "probability-slides.pdf",
      mimeType: "application/pdf",
      generatorKey: "deck-renderer",
      generatedAt: "2026-07-12T18:00:00.000Z",
      metadata: { template: "default" },
      archivedAt: null,
    },
  ],
};

describe("CoursePackageCodec", () => {
  it("round-trips a lossless Course Planner package without data loss", async () => {
    const exported = await codec.exportPackage({
      profile: "course-planner-lossless",
      scope: { kind: "course", courseId: "course-1", termId: "term-1" },
      graph: sampleGraph,
      packageObjectId: "pkg-1",
      exportedAt: "2026-07-12T18:30:00.000Z",
    });

    expect(exported.inspection.detectedProfile).toBe("course-planner-lossless");
    const preview = await codec.importPackage(exported.bytes, {
      mode: "create-independent-fork",
    });

    expect(preview).toMatchObject({
      sourceFormat: "course-planner-lossless",
      isLossless: true,
      packageObjectId: "pkg-1",
      warnings: [],
      unsupportedResources: [],
    });
    expect(preview.idempotencyKey).toContain("pkg-1:");
    expect(preview.graph).toEqual(sampleGraph);
    expect(preview.graph?.artifacts[0]?.generatorKey).toBe("deck-renderer");
    expect(preview.graph?.artifacts[0]?.metadata).toEqual({ template: "default" });
  });

  it("imports a Common Cartridge subset as a mapping preview and reports unsupported resources", async () => {
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="cc-1">
  <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.1.0</schemaversion>
    <lomimscc:lom xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource">
      <lomimscc:general>
        <lomimscc:title>
          <lomimscc:string>Imported Probability Unit</lomimscc:string>
        </lomimscc:title>
      </lomimscc:general>
    </lomimscc:lom>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>Probability</title>
      <item identifier="ITEM-MODULE">
        <title>Probability</title>
        <item identifier="ITEM-READING" identifierref="RES-READING">
          <title>Reading</title>
        </item>
        <item identifier="ITEM-LINK" identifierref="RES-LINK">
          <title>Reference link</title>
        </item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-READING" type="webcontent" href="webcontent/reading.html">
      <file href="webcontent/reading.html" />
    </resource>
    <resource identifier="RES-LINK" type="imswl_xmlv1p1" href="links/reference.xml">
      <file href="links/reference.xml" />
    </resource>
    <resource identifier="RES-UNSUPPORTED" type="imsdt_xmlv1p0" href="discussions/thread.xml">
      <file href="discussions/thread.xml" />
    </resource>
  </resources>
</manifest>`;

    const bytes = createZip([
      { name: "imsmanifest.xml", bytes: encodeText(manifest) },
      { name: "webcontent/reading.html", bytes: encodeText("<h1>Reading</h1>") },
      { name: "links/reference.xml", bytes: encodeText("<url>https://example.edu</url>") },
      { name: "discussions/thread.xml", bytes: encodeText("<discussion />") },
    ]);

    const preview = await codec.importPackage(bytes, {
      mode: "preview-only",
      allowLossyImport: true,
    });

    expect(preview).toMatchObject({
      sourceFormat: "common-cartridge",
      isLossless: false,
      packageObjectId: null,
      revisionHash: null,
    });
    expect(preview.commonCartridge?.title).toBe("Imported Probability Unit");
    expect(preview.commonCartridge?.learningModules).toEqual([
      {
        title: "Probability",
        items: [
          {
            identifier: "ITEM-READING",
            title: "Reading",
            resourceType: "webcontent",
            href: "webcontent/reading.html",
          },
          {
            identifier: "ITEM-LINK",
            title: "Reference link",
            resourceType: "imswl_xmlv1p1",
            href: "links/reference.xml",
          },
        ],
      },
    ]);
    expect(preview.unsupportedResources).toEqual([
      {
        identifier: "RES-UNSUPPORTED",
        type: "imsdt_xmlv1p0",
        href: "discussions/thread.xml",
      },
    ]);
    expect(preview.warnings).toContain(
      "Unsupported Common Cartridge resources were reported before apply.",
    );
  });

  it("rejects unsafe ZIP entry paths during import", async () => {
    const bytes = createZip([
      { name: "imsmanifest.xml", bytes: encodeText("<manifest />") },
      { name: "content/ok.txt", bytes: encodeText("ok") },
    ]);
    const tampered = new Uint8Array(bytes);
    const unsafeName = "aa/../evil.txt";
    const encodedUnsafeName = encodeText(unsafeName);
    const encodedSafeName = encodeText("content/ok.txt");
    for (let index = 0; index <= bytes.length - encodedSafeName.length; index += 1) {
      if (encodedSafeName.every((value, innerIndex) => bytes[index + innerIndex] === value)) {
        tampered.set(encodedUnsafeName, index);
      }
    }

    await expect(codec.importPackage(tampered, { mode: "preview-only" })).rejects.toThrow(
      "Unsafe ZIP entry path",
    );
  });
});

describe("SampleSyllabusImportService", () => {
  it("keeps syllabus import as a clearly labeled Phase-9-ready stub", async () => {
    const service = new SampleSyllabusImportService();
    const analysis = await service.analyze({
      syllabus: {
        kind: "uploaded_bytes",
        filename: "syllabus.md",
        mimeType: "text/markdown",
        bytes: encodeText("DS 101 Probability on Tuesdays and Thursdays"),
      },
      instructorId: "instructor-1",
    });

    expect(analysis.status).toBe("sample_extraction_only");
    expect(analysis.warnings[0]).toContain("Phase 9");

    const draft = await service.clarify(analysis.analysisId, {
      meetingDays: ["tuesday", "thursday"],
      firstMeeting: "2026-01-20",
    });
    const result = await service.apply(draft.draftId, {
      acceptSampleDraft: true,
    });

    expect(draft.status).toBe("sample_extraction_only");
    expect(result.created).toBe(false);
    expect(result.warnings.join(" ")).toContain("Lane B only exposes a Phase-9-ready sample workflow");
  });
});
