// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarWorkspace } from "./CalendarWorkspace";
import type { CalendarSlot, TermException } from "../../lib/b2r-prototype-fixture";

const calendarSlots: CalendarSlot[] = [
  { date: "2026-01-12", type: "class", label: "Week 1 meeting" },
  { date: "2026-02-16", type: "holiday", label: "Presidents' Day" },
  { date: "2026-03-05", type: "break", label: "Spring break" },
  { date: "2026-04-22", type: "reading-day", label: "Reading day" },
  { date: "2026-05-01", type: "finals", label: "Final exam period" },
];

const termExceptions: TermException[] = [
  { date: "2026-02-18", kind: "canceled", reason: "Campus closed for weather" },
];

describe("CalendarWorkspace", () => {
  it("labels inherited periods and term-only exceptions distinctly", () => {
    render(
      <CalendarWorkspace
        institutionLabel="State University"
        termLabel="Spring 2026"
        calendarSlots={calendarSlots}
        termExceptions={termExceptions}
        onAddException={vi.fn()}
      />,
    );

    expect(screen.getByText(/Institution calendar inheritance/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /State University calendar periods/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Inherited from State University/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Term-only exceptions for Spring 2026/i })).toBeInTheDocument();
    expect(screen.getByText(/This is term-only by design/i)).toBeInTheDocument();
  });

  it("shows finals and special periods explicitly", () => {
    render(
      <CalendarWorkspace
        institutionLabel="State University"
        termLabel="Spring 2026"
        calendarSlots={calendarSlots}
        termExceptions={termExceptions}
        onAddException={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: /^Finals period$/i })).toBeInTheDocument();
    expect(screen.getByText(/Finals are shown explicitly rather than folded into a generic class week/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Special periods$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/^Reading day$/i).length).toBeGreaterThan(0);
  });

  it("submits a term-only exception through the callback", () => {
    const onAddException = vi.fn();

    render(
      <CalendarWorkspace
        institutionLabel="State University"
        termLabel="Spring 2026"
        calendarSlots={calendarSlots}
        termExceptions={termExceptions}
        onAddException={onAddException}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Exception date/i), {
      target: { value: "2026-03-10" },
    });
    fireEvent.change(screen.getByLabelText(/Exception kind/i), {
      target: { value: "moved" },
    });
    fireEvent.change(screen.getByLabelText(/Reason/i), {
      target: { value: "Move the exam review to the following week." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Add term-only exception/i }));

    expect(onAddException).toHaveBeenCalledTimes(1);
    expect(onAddException).toHaveBeenCalledWith({
      date: "2026-03-10",
      kind: "moved",
      reason: "Move the exam review to the following week.",
    });
  });
});
