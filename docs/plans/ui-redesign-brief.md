# UI redesign brief

Read with `docs/why-this-exists.md` and `docs/design-principles.md`.

## Two modes

### Setup: fill in the course

The instructor fills in what the course needs:

- the learning outcomes;
- the topics that meet them;
- the meeting schedule;
- the assignments and activities they already have.

They do this out of order. They jump between parts as they track down material
and make decisions. Setup ends when the instructor chooses. Every setup item
stays editable from the calendar.

### Run time: the calendar

Once the initial content exists, the instructor always sees the course as a
calendar: a real calendar, not a list.

- It shows where the term is now, what has happened, and what is planned.
- Status shows as color and visual hints on each item.
- A past meeting with no record of what happened shows as unconfirmed. The
  instructor confirms it or corrects it.
- A canceled meeting stays visible, marked as canceled.
- Due dates and assignment windows show as multi-day bars.
- The arrows move between terms. The next term (for example Spring 2027) is
  the same calendar.

## An opened meeting

An opened meeting shows its topics, its activities, its Learning Module, its due
dates, its size, and its notes.

## Actions on the calendar

**Cancel a meeting.** Open the meeting and delete it, as with a normal calendar
event. This starts the shift workflow, which moves its content to the future.

**Cut something that did not fit.** Open a meeting and remove a topic, an
activity, or part of one. This starts the same shift workflow.

**Mark something as not great.** Open any item and mark it, or a part of it, as
not great. This adds a note for next term on that item.

### The shift workflow

The shift workflow moves displaced content to later meetings. It follows design
principle 8:

1. The agent proposes where the displaced topics, activities, and assignments go.
2. The calendar shows the result in place: the shifted items and the updated
   load.
3. The instructor accepts, edits, or rejects the proposal.

## Needs attention

- An item, a date, or an event that needs attention shows a mark (for example
  an exclamation point) on the calendar.
- Term-wide items that need attention show at the top of the calendar.
- Notes for next term appear as attention marks when the instructor opens the
  next term. There is no separate between-terms screen.
- When a change creates a student overload, the affected weeks get an
  attention mark.

## Workload

- Each item shows its size (S, M, L) on the calendar itself.
- Workload is a lens on the same calendar view, not a separate page.
- After a shift, the calendar shows the new load at once.

## Coverage

Topic coverage is a lens on the same calendar, like workload. It shows where
each topic is introduced, practiced, and assessed, and where the gaps are.

## The agent

The agent is everywhere. It works with the instructor in setup, in the shift
workflow, and on the notes for next term.

## Views

- An instructor view and a student view of the same calendar, with a toggle.
- A course switcher for an instructor with several courses.

## Desktop and phone

They serve two different goals.

- **Desktop: planning and results.** The calendar in context, with the space to
  see a term, its load, and its coverage. Most work happens here.
- **Phone: right now.** The meeting or activity at hand, for example:
  - the lecture plan for the selected lecture, with links to its content and
    activities;
  - the notes on an activity;
  - everything an activity depends on, for example for oral interviews: the
    question bank, the student schedule, and the rooms.

## Prior art

The operator's own calendars:

- **A month view in a general calendar app.** Assignment windows and project
  phases are multi-day bars. Class meetings are timed entries. Sizes are in the
  titles ("[S]", "[M]"). Holidays are bars.
- **An academic-year calendar sheet.** Twelve months on one page. Each class
  day shows its lecture number. A color key marks first and last day of class,
  canceled or away, holiday, exam preparation, exam week, and an alternate
  (Monday) schedule.
