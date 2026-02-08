# Calendar Parsing Prompt

## Context

Many institutions publish academic calendars as visual
spreadsheets with color-coded cells. This prompt is for
extracting structured data from those visual calendars
so it can be imported into the course planner.

This is a reference prompt — adapt it for specific
institutions and calendar formats.

## The Prompt

> I have uploaded files representing an Academic Calendar
> (some combination of XLSX, PDF, and/or HTML). Please
> use all available formats to understand the schedule:
>
> **The Layout:** Each calendar day consists of a 2x2 grid
> of cells. The Top Half (merged) contains the Date. The
> Bottom Half (merged) contains the Lecture Number or
> Topic.
>
> **The Logic:** The background fill color of the Bottom
> Half indicates the event type. Refer to the HTML source
> code for specific hex codes:
>
> - [Hex Code, e.g., #FFCECE] = Lecture Day
> - [Hex Code, e.g., #D9EAD3] = Discussion/Section
> - [Hex Code, e.g., #FFF2CC] = Holiday (No Class)
> - [Hex Code, e.g., #F4CCCC] = Exam/Finals
>
> **The Goal:** Please cross-reference the visual layout
> in the PDF with the data in the HTML/XLSX. First,
> confirm you have identified the grid structure and the
> color-coding correctly. Then, please [insert your task
> here, e.g., 'generate a JSON array of calendar slots
> for import into the course planner'].

## Adapting for Course Planner Import

To generate the JSON payload for
`POST /api/terms/[id]/import-calendar`, ask the model to
output:

```json
{
  "slots": [
    {
      "date": "2026-01-20",
      "dayOfWeek": "Tuesday",
      "slotType": "class_day"
    },
    {
      "date": "2026-02-16",
      "dayOfWeek": "Monday",
      "slotType": "holiday",
      "label": "Presidents' Day"
    }
  ]
}
```

Where `slotType` is one of: `class_day`, `holiday`,
`finals`, `break`.

## Notes

- The hex codes vary by institution and spreadsheet. The
  HTML source is usually the most reliable for extracting
  exact colors.
- Cross-referencing PDF (visual) with HTML/XLSX (data)
  catches parsing errors that either format alone might
  miss.
- The calendar defines AVAILABLE time slots, not course
  content. Sessions are placed into slots separately via
  the course structure import.
