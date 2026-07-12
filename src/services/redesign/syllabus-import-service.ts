import { createHash, randomUUID } from "node:crypto";

export type ImportSource =
  | {
      kind: "uploaded_bytes";
      filename: string;
      mimeType: string;
      bytes: Uint8Array;
    }
  | {
      kind: "uri";
      uri: string;
    };

export type CourseCreationAnalysis = {
  analysisId: string;
  status: "sample_extraction_only";
  warnings: string[];
  extractedSignals: {
    proposedTitle: string | null;
    proposedNumber: string | null;
    detectedDateMentions: string[];
    meetingClues: string[];
  };
};

export type CourseCreationDraft = {
  draftId: string;
  analysisId: string;
  status: "sample_extraction_only";
  warnings: string[];
  course: {
    title: string;
    number: string;
  };
  term: {
    institutionId: string | null;
    academicCalendarId: string | null;
    meetingDays: string[];
    firstMeeting: string | null;
  };
};

export type CourseCreationSelections = {
  acceptSampleDraft: boolean;
};

export type CourseCreationResult = {
  created: false;
  draftId: string;
  warnings: string[];
};

export interface CourseCreationImporter {
  analyze(input: {
    syllabus: ImportSource;
    instructorId: string;
    institutionId?: string;
    academicCalendarId?: string;
  }): Promise<CourseCreationAnalysis>;

  clarify(
    analysisId: string,
    answers: {
      meetingDays: string[];
      meetingTimes?: string[];
      firstMeeting?: string;
      sessionTypes?: string[];
      excludedDates?: string[];
    },
  ): Promise<CourseCreationDraft>;

  apply(
    draftId: string,
    selections: CourseCreationSelections,
  ): Promise<CourseCreationResult>;
}

export class SampleSyllabusImportService implements CourseCreationImporter {
  private readonly analyses = new Map<string, CourseCreationAnalysis>();
  private readonly drafts = new Map<string, CourseCreationDraft>();

  async analyze(input: {
    syllabus: ImportSource;
    instructorId: string;
    institutionId?: string;
    academicCalendarId?: string;
  }) {
    const analysisId = randomUUID();
    const textSample = sourcePreview(input.syllabus);
    const analysis: CourseCreationAnalysis = {
      analysisId,
      status: "sample_extraction_only",
      warnings: [
        "Sample extraction only. Real syllabus understanding stays Phase 9 until a provider-backed importer ships.",
      ],
      extractedSignals: {
        proposedTitle: inferTitle(textSample),
        proposedNumber: inferNumber(textSample),
        detectedDateMentions: [],
        meetingClues: inferMeetingClues(textSample),
      },
    };
    this.analyses.set(analysisId, analysis);
    return analysis;
  }

  async clarify(
    analysisId: string,
    answers: {
      meetingDays: string[];
      meetingTimes?: string[];
      firstMeeting?: string;
      sessionTypes?: string[];
      excludedDates?: string[];
    },
  ) {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) {
      throw new Error("Unknown syllabus analysis");
    }

    const draft: CourseCreationDraft = {
      draftId: randomUUID(),
      analysisId,
      status: "sample_extraction_only",
      warnings: analysis.warnings,
      course: {
        title: analysis.extractedSignals.proposedTitle ?? "Untitled course",
        number: analysis.extractedSignals.proposedNumber ?? "1XX",
      },
      term: {
        institutionId: null,
        academicCalendarId: null,
        meetingDays: answers.meetingDays,
        firstMeeting: answers.firstMeeting ?? null,
      },
    };
    this.drafts.set(draft.draftId, draft);
    return draft;
  }

  async apply(draftId: string, selections: CourseCreationSelections) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error("Unknown syllabus draft");
    }
    void selections;

    return {
      created: false,
      draftId,
      warnings: [
        ...draft.warnings,
        `No course was created. Lane B only exposes a Phase-9-ready sample workflow (${fingerprint(draft)}).`,
      ],
    } satisfies CourseCreationResult;
  }
}

function sourcePreview(source: ImportSource) {
  if (source.kind === "uri") return source.uri;
  const sample = new TextDecoder().decode(source.bytes.slice(0, 256));
  return `${source.filename} ${sample}`;
}

function inferTitle(sample: string) {
  const match = sample.match(/([A-Z][A-Za-z& ]{4,})/);
  return match?.[1]?.trim() ?? null;
}

function inferNumber(sample: string) {
  const match = sample.match(/\b([A-Z]{1,4}\s?\d{1,3}[A-Z]?)\b/);
  return match?.[1] ?? null;
}

function inferMeetingClues(sample: string) {
  const clues: string[] = [];
  if (/monday|mon\b/i.test(sample)) clues.push("monday");
  if (/tuesday|tue\b/i.test(sample)) clues.push("tuesday");
  if (/wednesday|wed\b/i.test(sample)) clues.push("wednesday");
  if (/thursday|thu\b/i.test(sample)) clues.push("thursday");
  if (/friday|fri\b/i.test(sample)) clues.push("friday");
  return clues;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}
