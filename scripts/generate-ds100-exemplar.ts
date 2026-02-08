/**
 * DS-100 Exemplar Seed Script
 *
 * Reads files in docs/ds100-exemplar/ and generates two JSON files:
 *   - ds100-calendar.json (Spring 2026 calendar slots)
 *   - ds100-structure.json (modules, sessions, skills, coverages, assessments)
 *
 * Usage: npx tsx scripts/generate-ds100-exemplar.ts
 *
 * These files serve as test data AND as a reference showing the import format.
 */

import * as fs from "fs";
import * as path from "path";

const DOCS = path.resolve(__dirname, "../docs/ds100-exemplar");
const OUT = path.resolve(__dirname, "../scripts");

// ─── Calendar generation ────────────────────────────────

interface CalendarSlot {
  date: string;
  dayOfWeek: string;
  slotType: "class_day" | "holiday" | "finals" | "break_day";
  label?: string;
}

function getDayOfWeek(date: Date): string {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][date.getUTCDay()];
}

function generateCalendarSlots(): CalendarSlot[] {
  // Spring 2026 term: Jan 20 – May 8
  const termStart = new Date("2026-01-20");
  const termEnd = new Date("2026-05-08");

  // Class meets Tue/Thu/Fri
  const classDays = new Set(["Tuesday", "Thursday", "Friday"]);

  // Holidays and breaks (from academic-calendar-2025-2027.md)
  const holidays: Record<string, string> = {
    "2026-01-19": "MLK Jr. Day",
    "2026-02-16": "Presidents' Day",
    "2026-04-20": "Patriots' Day",
  };

  // Special: Feb 17 follows Monday schedule (no class for TTh/F)
  const mondaySchedule = new Set(["2026-02-17"]);

  // Spring Recess: Mar 7–15
  const springBreakStart = new Date("2026-03-07");
  const springBreakEnd = new Date("2026-03-15");

  // Study period: May 1–3
  const studyStart = new Date("2026-05-01");
  const studyEnd = new Date("2026-05-03");

  // Finals: May 4–8
  const finalsStart = new Date("2026-05-04");
  const finalsEnd = new Date("2026-05-08");

  const slots: CalendarSlot[] = [];
  const current = new Date(termStart);

  while (current <= termEnd) {
    const dateStr = current.toISOString().slice(0, 10);
    const dow = getDayOfWeek(current);

    if (current >= finalsStart && current <= finalsEnd) {
      slots.push({
        date: dateStr,
        dayOfWeek: dow,
        slotType: "finals",
        label: "Finals Period",
      });
    } else if (current >= studyStart && current <= studyEnd) {
      slots.push({
        date: dateStr,
        dayOfWeek: dow,
        slotType: "break_day",
        label: "Study Period",
      });
    } else if (current >= springBreakStart && current <= springBreakEnd) {
      slots.push({
        date: dateStr,
        dayOfWeek: dow,
        slotType: "break_day",
        label: "Spring Recess",
      });
    } else if (holidays[dateStr]) {
      slots.push({
        date: dateStr,
        dayOfWeek: dow,
        slotType: "holiday",
        label: holidays[dateStr],
      });
    } else if (mondaySchedule.has(dateStr)) {
      slots.push({
        date: dateStr,
        dayOfWeek: dow,
        slotType: "holiday",
        label: "Monday Schedule (no TTh/F class)",
      });
    } else if (classDays.has(dow)) {
      slots.push({
        date: dateStr,
        dayOfWeek: dow,
        slotType: "class_day",
      });
    }
    // Skip non-class weekdays and weekends

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return slots;
}

// ─── Structure generation ───────────────────────────────

interface ImportModule {
  code: string;
  sequence: number;
  title: string;
  description: string;
  learningObjectives: string[];
  sessions: ImportSession[];
}

interface ImportSession {
  code: string;
  sessionType: "lecture" | "lab";
  title: string;
  date: string | null;
  description: string;
  sequence: number;
}

interface ImportSkill {
  code: string;
  category: string;
  description: string;
  moduleCode: string;
}

interface ImportCoverage {
  sessionCode: string;
  skillCode: string;
  level: "introduced" | "practiced" | "assessed";
}

interface ImportAssessment {
  code: string;
  assessmentType: "gaie" | "assignment" | "exam" | "project";
  title: string;
  description: string;
  progressionStage: string | null;
  skillCodes: string[];
  dueDate: string | null;
}

// Schedule data from ds100_schedule_instructor.md
const scheduleEntries = [
  { date: "2026-01-20", type: "lecture", code: "lec-01", lm: "LM-00", title: "Onboarding & Tools", status: "scheduled" },
  { date: "2026-01-22", type: "lecture", code: "lec-02", lm: "LM-00", title: "Course Workflow", status: "scheduled" },
  { date: "2026-01-23", type: "lab", code: "lab-01", lm: "LM-00", title: "Setup & Verification", status: "scheduled" },
  { date: "2026-01-27", type: "lecture", code: "lec-03", lm: "LM-01", title: "CANCELED — Instructor Absence", status: "canceled" },
  { date: "2026-01-29", type: "lecture", code: "lec-04", lm: "LM-01", title: "CANCELED — Instructor Absence", status: "canceled" },
  { date: "2026-01-30", type: "lab", code: "lab-02", lm: "LM-01", title: "Programming Foundations Practice", status: "scheduled" },
  { date: "2026-02-03", type: "lecture", code: "lec-05", lm: "LM-01", title: "Programming Basics (Catch-up)", status: "scheduled" },
  { date: "2026-02-05", type: "lecture", code: "lec-06", lm: "LM-02", title: "Tables & Claims", status: "scheduled" },
  { date: "2026-02-06", type: "lab", code: "lab-03", lm: "LM-02", title: "Tables Practice", status: "scheduled" },
  { date: "2026-02-10", type: "lecture", code: "lec-07", lm: "LM-03", title: "Data Manipulation", status: "scheduled" },
  { date: "2026-02-12", type: "lecture", code: "lec-08", lm: "LM-03", title: "Visualization Basics", status: "scheduled" },
  { date: "2026-02-13", type: "lab", code: "lab-04", lm: "LM-03", title: "Patterns Practice", status: "scheduled" },
  { date: "2026-02-19", type: "lecture", code: "lec-09", lm: "LM-04", title: "Variation & Histograms", status: "scheduled" },
  { date: "2026-02-20", type: "lab", code: "lab-05", lm: "LM-04", title: "Histogram Interpretation", status: "scheduled" },
  { date: "2026-02-24", type: "lecture", code: "lec-10", lm: "LM-05", title: "Probability Foundations", status: "scheduled" },
  { date: "2026-02-26", type: "lecture", code: "lec-11", lm: "LM-05", title: "Simulation & Randomness", status: "scheduled" },
  { date: "2026-02-27", type: "lab", code: "lab-06", lm: "LM-05", title: "Probability Lab", status: "scheduled" },
  { date: "2026-03-03", type: "lecture", code: "lec-12", lm: "LM-05", title: "Sampling Distributions", status: "scheduled" },
  { date: "2026-03-05", type: "lecture", code: "lec-13", lm: "LM-05", title: "Bootstrap Foundations", status: "scheduled" },
  { date: "2026-03-06", type: "lab", code: "lab-07", lm: "LM-05", title: "Sampling Lab", status: "scheduled" },
  { date: "2026-03-17", type: "lecture", code: "lec-14", lm: "LM-06", title: "Hypothesis Testing", status: "scheduled" },
  { date: "2026-03-19", type: "lecture", code: "lec-15", lm: "LM-06", title: "A/B Testing", status: "scheduled" },
  { date: "2026-03-20", type: "lab", code: "lab-08", lm: "LM-06", title: "Testing Lab", status: "scheduled" },
  { date: "2026-03-24", type: "lecture", code: "lec-16", lm: "LM-06", title: "Review & Reinforcement", status: "scheduled" },
  { date: "2026-03-26", type: "lecture", code: "lec-17", lm: "LM-06", title: "Applied Review", status: "scheduled" },
  { date: "2026-03-27", type: "lab", code: "lab-09", lm: "LM-06", title: "Review Lab", status: "scheduled" },
  { date: "2026-03-31", type: "lecture", code: "lec-18", lm: "LM-07", title: "Regression Concepts", status: "scheduled" },
  { date: "2026-04-02", type: "lecture", code: "lec-19", lm: "LM-07", title: "Regression Practice", status: "scheduled" },
  { date: "2026-04-03", type: "lab", code: "lab-10", lm: "LM-07", title: "Regression Lab / Project Release", status: "scheduled" },
  { date: "2026-04-07", type: "lecture", code: "lec-20", lm: "LM-07", title: "Classification Concepts", status: "scheduled" },
  { date: "2026-04-09", type: "lecture", code: "lec-21", lm: "LM-07", title: "Model Evaluation", status: "scheduled" },
  { date: "2026-04-10", type: "lab", code: "lab-11", lm: "LM-07", title: "Classification Lab / Clinic", status: "scheduled" },
  { date: "2026-04-14", type: "lecture", code: "lec-22", lm: "LM-07", title: "Ethics & Bias in Modeling", status: "scheduled" },
  { date: "2026-04-16", type: "lecture", code: "lec-23", lm: "LM-07", title: "Communicating Results", status: "scheduled" },
  { date: "2026-04-17", type: "lab", code: "lab-12", lm: "LM-07", title: "Ethics & Communication Lab", status: "scheduled" },
  { date: "2026-04-21", type: "lecture", code: "lec-24", lm: "LM-07", title: "Project Synthesis", status: "scheduled" },
  { date: "2026-04-23", type: "lecture", code: "lec-25", lm: "LM-07", title: "Data Storytelling", status: "scheduled" },
  { date: "2026-04-24", type: "lab", code: "lab-13", lm: "LM-07", title: "Synthesis & Defense Lab", status: "scheduled" },
  { date: "2026-04-28", type: "lecture", code: "lec-26", lm: "LM-07", title: "Final Project Work Time", status: "scheduled" },
  { date: "2026-04-30", type: "lecture", code: "lec-27", lm: "LM-07", title: "Course Wrap-Up", status: "scheduled" },
];

// Module definitions
const moduleDefinitions = [
  { code: "LM-00", seq: 0, title: "Onboarding and Course Info", desc: "Setup, workflow, GenAI zones, and tool orientation.", objectives: ["Navigate course tools and platforms", "Understand the weekly course rhythm", "Describe GenAI zones and integrity expectations"] },
  { code: "LM-01", seq: 1, title: "Programming Basics", desc: "Python fundamentals: variables, types, lists, debugging, imports.", objectives: ["Use variables and basic data types", "Create and manipulate lists", "Apply basic debugging habits", "Import and use standard libraries"] },
  { code: "LM-02", seq: 2, title: "Data Claims", desc: "DataFrames, exploration, cleaning, and evidence-based claims.", objectives: ["Create and explore DataFrames", "Clean data using standard methods", "Frame claims with evidence and limitations"] },
  { code: "LM-03", seq: 3, title: "Seeing Patterns in Data", desc: "Filtering, grouping, aggregation, and visualization for pattern recognition.", objectives: ["Filter, sort, and group data", "Create and interpret basic charts", "Connect patterns to evidence-based claims"] },
  { code: "LM-04", seq: 4, title: "Variation", desc: "Histograms, distributions, center, spread, and outlier effects.", objectives: ["Interpret histograms and distribution shape", "Describe center and spread", "Reason about variation across distributions"] },
  { code: "LM-05", seq: 5, title: "Uncertainty", desc: "Probability, simulation, sampling, bootstrap, and confidence intervals.", objectives: ["Apply basic probability rules", "Use simulation for randomness modeling", "Build and interpret bootstrap distributions", "Interpret confidence intervals"] },
  { code: "LM-06", seq: 6, title: "Testing Ideas", desc: "Hypothesis testing, p-values, Type I/II errors, A/B testing, validity.", objectives: ["Explain hypothesis testing logic", "Interpret p-values and significance", "Design and critique A/B tests"] },
  { code: "LM-07", seq: 7, title: "Modeling and Communication", desc: "Regression, classification, model evaluation, ethics, and data storytelling.", objectives: ["Fit and interpret linear regression", "Describe classification concepts", "Evaluate models and analyze ethics", "Communicate results to nontechnical audiences"] },
];

// Skills from ds100_skills_canonical.md
function parseSkills(): ImportSkill[] {
  const content = fs.readFileSync(path.join(DOCS, "ds100_skills_canonical.md"), "utf-8");
  const skills: ImportSkill[] = [];
  let currentModule = "";
  let currentCategory = "";

  for (const line of content.split("\n")) {
    const moduleMatch = line.match(/^## (LM-\d+)/);
    if (moduleMatch) {
      currentModule = moduleMatch[1];
      // Derive category from module title
      const modDef = moduleDefinitions.find((m) => m.code === currentModule);
      currentCategory = modDef?.title || currentModule;
      continue;
    }

    const categoryMatch = line.match(/^### (.+)/);
    if (categoryMatch) {
      // Use the module title as category prefix
      continue;
    }

    const skillMatch = line.match(/^- (LM\d+-[CX]\d+)\s+(.+)/);
    if (skillMatch) {
      const code = skillMatch[1];
      const description = skillMatch[2].trim();
      // Determine category from code: C = Core, X = Expansion
      const isExpansion = code.includes("-X");
      skills.push({
        code,
        category: `${currentCategory}${isExpansion ? " (Expansion)" : ""}`,
        description,
        moduleCode: currentModule,
      });
    }
  }

  return skills;
}

function generateStructure() {
  const skills = parseSkills();

  // Build modules with sessions
  const modules: ImportModule[] = moduleDefinitions.map((mod) => {
    const modSessions = scheduleEntries
      .filter((e) => e.lm === mod.code)
      .map((e, i) => ({
        code: e.code,
        sessionType: e.type as "lecture" | "lab",
        title: e.title,
        date: e.date,
        description: `${e.type === "lecture" ? "Lecture" : "Lab"}: ${e.title}`,
        sequence: i + 1,
      }));

    return {
      code: mod.code,
      sequence: mod.seq,
      title: mod.title,
      description: mod.desc,
      learningObjectives: mod.objectives,
      sessions: modSessions,
    };
  });

  // Generate realistic coverage entries
  // Strategy: each module's core skills are introduced in lectures, practiced in labs
  const coverages: ImportCoverage[] = [];
  const skillsByModule = new Map<string, ImportSkill[]>();

  for (const skill of skills) {
    if (!skill.moduleCode) continue;
    if (!skillsByModule.has(skill.moduleCode)) {
      skillsByModule.set(skill.moduleCode, []);
    }
    skillsByModule.get(skill.moduleCode)!.push(skill);
  }

  for (const mod of modules) {
    const modSkills = skillsByModule.get(mod.code) || [];
    const coreSkills = modSkills.filter((s) => s.code.includes("-C"));
    const lectures = mod.sessions.filter((s) => s.sessionType === "lecture");
    const labs = mod.sessions.filter((s) => s.sessionType === "lab");

    // Distribute skills across lectures (introduced)
    for (let i = 0; i < coreSkills.length; i++) {
      const lecIdx = Math.min(i % lectures.length, lectures.length - 1);
      if (lectures[lecIdx]) {
        coverages.push({
          sessionCode: lectures[lecIdx].code,
          skillCode: coreSkills[i].code,
          level: "introduced",
        });
      }
    }

    // Practice in labs
    for (let i = 0; i < coreSkills.length; i++) {
      const labIdx = Math.min(i % labs.length, labs.length - 1);
      if (labs[labIdx]) {
        coverages.push({
          sessionCode: labs[labIdx].code,
          skillCode: coreSkills[i].code,
          level: "practiced",
        });
      }
    }
  }

  // Assessments (from schedule and GAIE data)
  const assessments: ImportAssessment[] = [
    {
      code: "GAIE-01",
      assessmentType: "gaie",
      title: "Programming Basics GAIE",
      description: "Copy-paste AI prompt exercise on programming concepts.",
      progressionStage: "copy-paste",
      skillCodes: ["LM01-C01", "LM01-C02", "LM01-C03"],
      dueDate: "2026-02-03",
    },
    {
      code: "GAIE-02",
      assessmentType: "gaie",
      title: "Data Manipulation GAIE",
      description: "Copy-paste AI prompt exercise on data manipulation.",
      progressionStage: "copy-paste",
      skillCodes: ["LM03-C01", "LM03-C02", "LM03-C03"],
      dueDate: "2026-02-10",
    },
    {
      code: "GAIE-03",
      assessmentType: "gaie",
      title: "Variation & Distributions GAIE",
      description: "Copy-paste AI prompt exercise on histograms and variation.",
      progressionStage: "copy-paste",
      skillCodes: ["LM04-C01", "LM04-C02"],
      dueDate: "2026-02-19",
    },
    {
      code: "GAIE-04",
      assessmentType: "gaie",
      title: "Probability & Simulation GAIE",
      description: "Modify AI prompt exercise on probability concepts.",
      progressionStage: "modify",
      skillCodes: ["LM05-C01", "LM05-C02"],
      dueDate: "2026-02-24",
    },
    {
      code: "GAIE-05",
      assessmentType: "gaie",
      title: "Sampling & Bootstrap GAIE",
      description: "Modify AI prompt exercise on sampling and bootstrap.",
      progressionStage: "modify",
      skillCodes: ["LM05-C03", "LM05-C04", "LM05-C05"],
      dueDate: "2026-03-03",
    },
    {
      code: "GAIE-06",
      assessmentType: "gaie",
      title: "Hypothesis Testing GAIE",
      description: "Modify AI prompt exercise on hypothesis testing.",
      progressionStage: "modify",
      skillCodes: ["LM06-C01", "LM06-C02", "LM06-C03"],
      dueDate: "2026-03-17",
    },
    {
      code: "GAIE-07",
      assessmentType: "gaie",
      title: "Regression & Modeling GAIE",
      description: "Write-own AI prompt exercise on regression and modeling.",
      progressionStage: "write-own",
      skillCodes: ["LM07-C01", "LM07-C02", "LM07-C03"],
      dueDate: "2026-03-31",
    },
    {
      code: "MINI-PROJECT",
      assessmentType: "project",
      title: "Mini-Project: Team Data Analysis",
      description: "Team-based data analysis project covering modules 1–6.",
      progressionStage: null,
      skillCodes: ["LM03-C01", "LM03-C05", "LM05-C04", "LM05-C06"],
      dueDate: "2026-03-23",
    },
    {
      code: "FINAL-PROJECT",
      assessmentType: "project",
      title: "Final Project: Independent Analysis",
      description: "Independent analysis project covering all modules.",
      progressionStage: null,
      skillCodes: ["LM07-C01", "LM07-C04", "LM07-C05", "LM07-C06"],
      dueDate: "2026-05-04",
    },
  ];

  return { modules, skills, coverages, assessments };
}

// ─── Main ───────────────────────────────────────────────

function main() {
  console.log("Generating DS-100 exemplar data...\n");

  // Calendar
  const calendarSlots = generateCalendarSlots();
  const calendarPath = path.join(OUT, "ds100-calendar.json");
  fs.writeFileSync(
    calendarPath,
    JSON.stringify({ slots: calendarSlots }, null, 2),
  );
  console.log(`Calendar: ${calendarSlots.length} slots → ${calendarPath}`);
  const classDays = calendarSlots.filter((s) => s.slotType === "class_day").length;
  const holidays = calendarSlots.filter((s) => s.slotType === "holiday").length;
  const breaks = calendarSlots.filter((s) => s.slotType === "break_day").length;
  const finals = calendarSlots.filter((s) => s.slotType === "finals").length;
  console.log(`  ${classDays} class days, ${holidays} holidays, ${breaks} break days, ${finals} finals\n`);

  // Structure
  const structure = generateStructure();
  const structurePath = path.join(OUT, "ds100-structure.json");
  fs.writeFileSync(structurePath, JSON.stringify(structure, null, 2));
  console.log(`Structure → ${structurePath}`);
  console.log(`  ${structure.modules.length} modules`);
  console.log(`  ${structure.modules.reduce((n, m) => n + m.sessions.length, 0)} sessions`);
  console.log(`  ${structure.skills.length} skills`);
  console.log(`  ${structure.coverages.length} coverages`);
  console.log(`  ${structure.assessments.length} assessments`);

  console.log("\nDone. Import these files via the /terms/[id]/import page.");
}

main();
