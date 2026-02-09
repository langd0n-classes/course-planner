import { describe, it, expect } from "vitest";
import { calendarSlotImportSchema, importCalendarSchema } from "./schemas";

describe("calendarSlotImportSchema", () => {
  it("accepts break_day as slotType", () => {
    const result = calendarSlotImportSchema.safeParse({
      date: "2026-03-15",
      dayOfWeek: "Monday",
      slotType: "break_day",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slotType).toBe("break_day");
    }
  });

  it("normalizes break to break_day", () => {
    const result = calendarSlotImportSchema.safeParse({
      date: "2026-03-15",
      dayOfWeek: "Monday",
      slotType: "break",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slotType).toBe("break_day");
    }
  });

  it("accepts class_day, holiday, finals", () => {
    for (const slotType of ["class_day", "holiday", "finals"] as const) {
      const result = calendarSlotImportSchema.safeParse({
        date: "2026-01-20",
        dayOfWeek: "Tuesday",
        slotType,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slotType).toBe(slotType);
      }
    }
  });

  it("rejects invalid slotType", () => {
    const result = calendarSlotImportSchema.safeParse({
      date: "2026-01-20",
      dayOfWeek: "Tuesday",
      slotType: "vacation",
    });
    expect(result.success).toBe(false);
  });
});

describe("importCalendarSchema", () => {
  it("normalizes break to break_day in full import payload", () => {
    const result = importCalendarSchema.safeParse({
      slots: [
        { date: "2026-03-09", dayOfWeek: "Monday", slotType: "break" },
        { date: "2026-03-10", dayOfWeek: "Tuesday", slotType: "break_day" },
        { date: "2026-01-20", dayOfWeek: "Tuesday", slotType: "class_day" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slots[0].slotType).toBe("break_day");
      expect(result.data.slots[1].slotType).toBe("break_day");
      expect(result.data.slots[2].slotType).toBe("class_day");
    }
  });
});
