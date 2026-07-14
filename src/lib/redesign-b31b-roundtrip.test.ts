import { describe, expect, it } from "vitest";

import {
  createAcademicCalendarVersionRequest,
  createCourseworkActivityVersionRequest,
  createMeetingActivityVersionRequest,
  createTermActivityRevisionPreviewRequest,
  createTermCalendarExceptionRequest,
  createUpsertTermMeetingPatternRequest,
} from "./redesign-fixtures";
import {
  createAcademicCalendarVersionSchema,
  createTermCalendarExceptionSchema,
  termActivityRevisionPreviewRequestSchema,
  upsertActivityVersionSchema,
  upsertTermMeetingPatternSchema,
} from "./redesign-schemas";

describe("B.3.1b fixture and runtime-contract integration", () => {
  it.each([
    ["meeting Activity version", upsertActivityVersionSchema, createMeetingActivityVersionRequest()],
    ["coursework Activity version", upsertActivityVersionSchema, createCourseworkActivityVersionRequest()],
    ["Term Activity revision", termActivityRevisionPreviewRequestSchema, createTermActivityRevisionPreviewRequest()],
    ["Term calendar exception", createTermCalendarExceptionSchema, createTermCalendarExceptionRequest()],
    ["Academic Calendar version", createAcademicCalendarVersionSchema, createAcademicCalendarVersionRequest()],
    ["Term meeting pattern", upsertTermMeetingPatternSchema, createUpsertTermMeetingPatternRequest()],
  ])("parses the deterministic %s request fixture", (_label, schema, request) => {
    expect(schema.safeParse(request)).toMatchObject({ success: true });
  });
});
