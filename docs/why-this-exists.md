# Why this exists

**Status: skeleton.** The evidence and prior-art findings below were gathered on 2026-08-14 and
are factual. The narrative, the history, and the voice are the operator's and are not written yet.
Sections marked TODO need something only he can supply.

---

## Operator narrative pass — write this next

This document is the product rationale and the source material for a later blog
essay. Write the operator evidence here first. Do not try to make this section
publish-ready while answering the questions; concrete history is more valuable
than polished prose at this stage.

### 1. Open with the course moving underneath the plan

Start with one real incident, not the market landscape.

- What changed while the course was running: a canceled meeting, a concept that
  did not land, a schedule compression, a redesigned assessment, or something
  else?
  - The most typical example is a snow day but I also broke my leg and had to cancel a lecture this past spring. however, the most common case is just not fitting everything in to a lecture (probably happens in discussions too but normally the TAs run those). sometimes the issue is that you misestimated the speed at which the content can be deliverred. however, another really common example is "delayed start" a) the students are trickling in even later than usual. b) the "tech" is broken/neeeds restart/ etc c) prior "user of the room" runs long. another one is that an activity takes the students longer than expected. there is often a delicate balance on "learning" of making sure the students "go fast enough" vs the author just assuming the work is "easier than it is" for a student.
- What did you need to decide immediately?
  - where to move the content.. likely continue the same content in to the next lecture if it was "just a lecture" .. sometimes it is axe an activity because you don't have time for the students to complete it during the alloted time left and you also may not be able to just bump it to next time because of loss of context for the students so you might need to rejigger. in the case of an activity taking to long for the students you might need to end it early, dump the results, make a new activity for next time to "do the same thing" but probably with new context and shorter "effort"
- Which documents or systems held pieces of the answer?
  - mostly prior art, a lot of my own but also searching around for options, then failing to "build it"
- What could none of them tell you about the consequences of the change?
  - downstream impact usually.. like i just lost a chunk of student facing time, what has to get compressed to fit everything? if i axed something does something later actually cover it already "well enough"?
- What did you track mentally or repair by hand?
  - all that? but updating the cal is hard. i also am particularly bad with calendars so its especially hard for me as a human. i am not sure if everyone shares that issue.

The incident should establish the core problem: the instructor needs to revise
the plan without erasing the difference between what was intended, what
happened, and what must happen next.

### 2. Explain the workaround that proved the need

- What did you build in markdown and git?
  - some activities use external tools like kahoot, mentimeter. biggest external tool is google slides because i have never found a "text based tool" precise enough in layout to make my slides in (tried marp, rise, reveal.js). markdown and git are for course design, genai prompts, rubrics, answer keys, lm overviews, "lecture plans", "discussion plans", activities based on notebooks like GAIEs, live demos, in class work. 551 has substantially different activity types but use a lot of the same tools.
- Which parts represented the course design, the term plan, and the delivered
  reality?
  - usually git holds (via markdown) deisng & plan .. the delivered is the checked in artifacts which are retained but the only "what happened" markers are git diffs on the plan which are tough for using history to inform the future
- How did you clone or adapt one term into another?
  - currently, i branch from last term or, if the class is pretty stable, maybe the prior version of the same term (eg. to make f26 i would use f25) because the cadence changes based on the term structure (6 wks for summer, spring break in spring, thanksgiving in fall). i never "merge back to main" and the branches just live forever to try to be minable for history.
- What questions could the workaround answer that Blackboard or a spreadsheet
  could not?
  - kind of all of this but it doesn't do it "well" its just tracking current state and then i modify it to be corrected current state.
- What remained expensive, fragile, or dependent on knowledge in your head?
  - hard not to say "all of it". one thing that may not have come up is the search for "i know i made an activity/slide deck/notebook for this topic/set of topics, where is it"
- How long did you keep using it, and why did you tolerate the maintenance cost?
  - still using, i don't have any better solution. tbh, i don't *like* the solution, it just works. has a lot of overhead in teaching it to TAs and alt instructors as well.

The existence of a durable workaround matters more than the number of products
considered. It shows that the need survived after the novelty wore off.

### 3. Use the tool categories to define the missing layer
ANSWERED IN THE SECTION BELOW

Keep the categories below. For each one, answer the same two questions:

1. What job is this category actually designed to do?
2. What happens when it is asked to preserve and revise a live course plan?

Identify one near-miss if possible. Which tool came closest, and what exact
boundary made you stop using it? A near-miss defines the product gap more clearly
than a long inventory of distant alternatives.

### 4. Explain why GenAI did not remove the problem

- What plans or redesigns did you generate with AI?
  - everything besides slides.. and for slides i had ai design the content and find the prior art. tbhm this would be better answered by looking at the content of ds100. ds551 is much less sophisticated in terms of this because it is an "easier class" (for me) and most of the course is "project" and "assignment" based like bigger ones .. but, if i had a tool like c-p 551 could be much richer i just don't have the time to bring it up to the same level is 100
- Where did the generated plan live after the conversation ended?
  - i have the tools document it in artifacts like the topics completed, calendar, lm and lecture overviews, activity overviews, etc. again, a review of actual ds100 would answer this much better.
- What happened when the calendar, topic map, or assessment strategy changed?
  - cascading fires for creating content for "next student meeting"
- Could the model distinguish canonical course design from one term's delivery?
  - yes, i have "course-info/*" and "course-info/term" which is where the diff lies on "structure" for content the diff is comparing to "last term" or looking at the git history of thre atifacts.
- Did replanning preserve prior decisions and their reasons, or begin again from
  a plausible-looking snapshot?
  - generally, i tried to do solid commit messages w/ the reasoning.I also try to take notes on what to do next semester. i also try to get my surveys and course eval feedback in to the plan for a next semester.

The claim to test is: GenAI can generate a plan, but generation without durable
structure turns every revision into another first draft.
  - kinda.. it does solidify over time.. c-p is making that happen faster and more simply/less effort for the operator.

### 5. Name the product boundary precisely

Course Planner does not run enrollment, deliver content, keep a gradebook, or
become the student system of record. It runs the **plan** while the course is in
motion.

- What state must Course Planner own?
- What content should remain in GitHub, Drive, or the LMS?
- Why must intended design and actual delivery remain separately visible?
- What should an instructor be able to simulate before committing a change?
- What question should this product answer in five minutes that currently takes
  an hour?

### 6. Close on the operating principle

End with the smallest durable claim, not the entire roadmap:

> A course plan has to survive contact with the course.

The product exists to preserve intended structure, record what actually
happened, and show the consequences of the next change before the instructor
commits it.

---

## The thesis

Existing tools help you **design** a course or **deliver** one. Nothing the operator found helps
an instructor run the **plan** while the course is moving and the instructor is inside it.

> "live fire course running"

That phrase is the scope test. When a feature is proposed, ask which it serves. Outcome roll-up is
design-time and review-time. "Probability didn't land, redo it in week 9" is live fire.

## The search

The operator evaluated many tools, spreadsheets, and approaches — before and after generative AI —
trying to solve course planning and design. None fit. He then built a bespoke system in
markdown and git and has run his course on it since.

That last fact matters more than the count. A costly workaround maintained for years is stronger
evidence of an unmet need than any number of tools tried and abandoned.

**TODO (operator):** the actual list, or as much of it as is worth recovering. Which one got
closest, and what specifically made you stop using it — the near-miss defines the gap better than
the far misses do.

## How the tools fail, by cluster

Four clusters, from the operator's own experience except where noted.

### PM-shaped — Asana, Notion, spreadsheets

Infinitely flexible, no domain model. The structure lives in your head, and it rots the moment the
term slips. The spreadsheet was abandoned quickly.

1. What job is this category actually designed to do?
2. What happens when it is asked to preserve and revise a live course plan?


**TODO (operator):** what specifically broke down — was it maintenance cost, or that the structure
could not represent the thing?

### LMS-shaped — Blackboard, Gradescope, Canvas

Built for delivery and measurement, not planning.

- **Blackboard Ultra does not let an instructor author a goal at all.** You may only align to goals
  the institution has already loaded. This is why DS-100's learning outcomes live in a syllabus
  markdown file rather than in the LMS.
- **Canvas** lets you author outcomes, organizes them hierarchically, and tracks per-student mastery
  through rubrics. Evaluated and judged not to bring enough to warrant leaving the in-house
  Blackboard setup, even free.
- **Canvas freezes an outcome once it has been used for grading.** That is the opposite of what
  running a course needs, where a topic can be reopened because office hours revealed a gap.
- **Gradescope** is adjacent rather than overlapping — assessment delivery and grading.
- No LMS models **the plan as a separate revisable artifact from what happened**. Move something in
  a Canvas calendar and it is simply moved: no diff, no impact preview, no record that the plan
  changed.

1. What job is this category actually designed to do?
2. What happens when it is asked to preserve and revise a live course plan?

### Curriculum-mapping-shaped — Coursetune, Watermark, Nuventive

Correct domain model, wrong tempo, wrong buyer. Aimed at annual program review and accreditation.

Not evaluated by the operator, and the reason is structural rather than a gap in diligence: these
are sold through institutional channels to assessment offices, not to instructors.

**Coursetune began selling in 2017 tailored to course design — helping professors "tune" their
courses.** Institutions and administrators were more interested in curriculum mapping for
accreditation, so the company redirected there. It was later acquired by Academic Partnerships.

That is the whole market structure in one data point. A company launched at the instructor-side
problem and was pulled to the buyer within a few years. The gap is real *because* it is
commercially unattractive: instructors do not hold budget.

1. What job is this category actually designed to do?
2. What happens when it is asked to preserve and revise a live course plan?

### Post-GenAI — prompting for a plan

Produces a plausible plan once, then has nowhere to live. No state, so replanning starts from
scratch. The operator's own attempts are the `ds100` and `pantheon` repos.

**TODO (operator):** this is the newest failure mode and the one worth writing about publicly.

1. What job is this category actually designed to do?
2. What happens when it is asked to preserve and revise a live course plan?

## The strongest evidence, from the operator's own repo

DS-100's Fall 2026 redesign plan, written months before this application could have influenced it:

> The previous fall content was built on the **old topic map** and was structurally unreliable, so
> it was archived rather than trusted as a base… Salvage from it; do not trust its sequencing…
> **Re-home each piece by topic** because the old lecture structure uses the old map.

An entire term's work was discarded because the topic map moved underneath it, and the salvage
procedure is *re-home by topic* — because topics are the stable anchor and lecture structure is not.

That is ADR-0002 and ADR-0004 stated as an operational fact rather than a design argument. If topics
were owned by modules, re-homing by topic would not be possible.

The same document describes the fall term as a clone of summer that must be "un-crashed" from a
compressed schedule into a full September–December cadence, driven by the canonical topic map and
the calendar. That is this application's core operation, being performed by hand with git branches
and folder conventions.

## What this application therefore is

The operational layer between designing a course and delivering it in an LMS.

- It owns **structure**: topics, activities, learning modules, terms, coverage, and what changed
  from plan.
- Content stays where content belongs — GitHub, Drive, the LMS.
- It never stores a row that identifies a student. See ADR-0004.
- Handoff to the LMS is by instructor-performed export (Common Cartridge, copy/paste), never by
  LTI or OneRoster integration, which requires institutional procurement an instructor cannot do.

## References

- Blackboard Ultra goals are institution-provided; instructors align but do not author:
  <https://help.blackboard.com/Learn/Instructor/Ultra/Performance/Goals>
- Canvas outcomes, rubric-mediated alignment and mastery tracking:
  <https://www.iit.edu/cli/canvas/outcomes-instructor-guide>
- Coursetune's redirection from course design to curriculum mapping:
  <https://www.edsurge.com/news/2021-09-02-is-curriculum-mapping-becoming-a-priority-for-online-college-programs>
- Curriculum mapping conventions, including I/R/M and taught-versus-assessed gap analysis:
  <https://manoa.hawaii.edu/assessment/resources/curriculum-mapping-curriculum-matrix/>
- Constructive alignment (Biggs, 1996): <https://en.wikipedia.org/wiki/Constructive_alignment>
