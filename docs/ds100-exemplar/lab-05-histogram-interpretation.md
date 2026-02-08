# Lab 05: Histogram Interpretation

## Purpose

Verify understanding of histogram interpretation and
distribution vocabulary through a mixed-format station
activity using the Boston Marathon 2024 dataset.

## Learning targets

- LM04-C01 Describe the shape of a distribution using
  standard vocabulary.
- LM04-C03 Read and interpret histograms accurately.
- LM04-C04 Recognize how bin width and scale choices
  affect histogram appearance.
- LM04-C05 Use precise language to compare distributions
  across subgroups.

## Skills verified

- Chart critique and identification of misleading design.
- Debugging histogram code and correcting interpretations.
- Building histograms that answer specific questions.
- Using shape, center, spread vocabulary precisely.

## Prep

- Complete GAIE-03 (variation and distributions).
- Review Lecture 09 notes on histogram vocabulary.
- Bring laptop with JupyterHub access.

## Format

Mixed-format station activity. 3 stations (15 minutes
each) plus wrap-up. Students work in pairs and rotate
through stations, or work sequentially if rotation is
not practical.

No AI tools allowed during this activity.

## Time plan (50 min)

- 0 to 2 min: Form pairs, distribute handouts, read
  instructions.
- 2 to 17 min: Station A — Chart Critique.
- 17 to 32 min: Station B — Debugging Challenge.
- 32 to 47 min: Station C — Visualization Swap.
- 47 to 50 min: Wrap-up reflection.

## Station A — Chart Critique (15 min)

Two pre-made histograms are printed on the handout:

**Histogram A1:** A well-designed histogram of marathon
finish times with appropriate bin width (15-minute bins).
Shape, center, and spread are clearly visible.

**Histogram A2:** A misleading histogram of the same data
with 120-minute bins that hides a bimodal pattern in the
subgroup data (men and women combined). The y-axis uses
raw counts with no label.

For each histogram, students write:

1. One sentence describing the distribution using shape,
   center, and spread.
2. For A2: What is misleading about this histogram?
   What specific change would fix the problem?

## Station B — Debugging Challenge (15 min)

Two code snippets are printed on the handout. Each
produces a broken or misleading histogram. Students
identify the bug, write the fix, and correct the
written interpretation.

**Snippet B1:** Code plots `Overall Place` instead of
`finish_time_hours`. The histogram looks uniform and
the interpretation says "finish times are evenly
distributed." Students fix the column name and rewrite
the interpretation.

**Snippet B2:** Code uses 3 bins for finish time data,
producing a histogram that looks symmetric. The
interpretation says "the distribution is roughly
symmetric." Students increase the bin count and rewrite
the interpretation to reflect the actual right-skewed
shape.

For each snippet, students write:

1. What is wrong with the code?
2. The corrected line of code.
3. A corrected 1-sentence interpretation.

## Station C — Visualization Swap (15 min)

Each pair receives a question card with a specific
question about the marathon data. Example questions:

- "How do finish times differ between runners under 30
  and runners over 50?"
- "What does the distribution of finish times look like
  for runners from Massachusetts?"
- "Is the distribution of finish times different for men
  and women?"

Each pair builds one histogram in their notebook that
answers their assigned question. They write a 1-sentence
interpretation on an index card (no question written).

At the 8-minute mark, pairs swap index cards and
histograms with another pair. The receiving pair:

1. Guesses what question the histogram was answering.
2. Rates the histogram on clarity (1 to 3 scale):
   can you tell what question it answers without being
   told?

## Wrap-up (3 min)

Each student writes on their handout:

"Name one thing you will check every time you make or
read a histogram after today."

## Grading

Completion-graded. 75 points total.

- Station A: 25 points (descriptions attempted for both
  histograms).
- Station B: 25 points (both bugs identified and fixes
  written).
- Station C: 25 points (histogram built and swap
  completed).

## What students submit or produce

- Printed handout with all station responses filled in,
  collected at end of lab.
- TA confirms completion during the session.

## Materials

- `lab-05/lab-05-handout.md` (print 1 per pair)
- `lab-05/lab-05-ta-key.md` (TA eyes only)
- `boston_marathon_2024.csv` available in lab environment
- Question cards for Station C (4 to 6 unique questions,
  print and cut)
- Index cards for Station C swap

## Dataset

`boston_marathon_2024.csv` — Boston Marathon 2024 finishers
with columns: Name, Gender, Age, City, State,
finish_time_hours, Overall Place.

## Common pitfalls

- Station A: Students say "the histogram is wrong" without
  specifying what is misleading and how to fix it.
- Station B: Students fix the code but do not rewrite the
  interpretation to match the corrected histogram.
- Station C: Histograms without axis labels or titles make
  the swap impossible. Remind pairs to label axes.

## Notes for staff

- Print handouts double-sided to save paper.
- For Station C, prepare 4 to 6 different question cards
  so adjacent pairs get different questions.
- If rotation is not practical (room layout), students
  can work through stations sequentially on the handout.
- Prioritize Station A and B for verification. Station C
  is valuable but completion of A and B matters more.
- The wrap-up reflection is quick but important. It
  anchors the habit of checking bin width and axis labels.
