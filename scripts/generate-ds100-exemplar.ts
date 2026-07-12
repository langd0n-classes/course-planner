import * as fs from "fs";
import * as path from "path";

const OUT = path.resolve(__dirname, "../scripts");

type CalendarSlot = {
  date: string;
  slotType: "class_day" | "holiday" | "finals" | "break_day";
  label?: string;
  source: string;
};

type ExemplarTopic = {
  stableCode: string;
  learningModuleStableCode: string | null;
  title: string;
  category: string;
  description: string;
};

type ExemplarLearningModule = {
  stableCode: string;
  title: string;
  description: string;
  learningObjectives: string[];
  topicStableCodes: string[];
};

type ExemplarStructure = {
  course: {
    title: string;
    number: string;
    numberIsPlaceholder: boolean;
  };
  institution: {
    name: string;
    shortName: string;
  };
  academicCalendar: {
    name: string;
    academicYear: string;
  };
  learningModules: ExemplarLearningModule[];
  topics: ExemplarTopic[];
  term: {
    code: string;
    name: string;
    plannedLearningModuleStableCodes: string[];
    deliveredLearningModuleStableCodes: string[];
  };
  sessions: Array<{
    code: string;
    learningModuleStableCode: string;
    title: string;
    sessionType: "lecture" | "lab";
    date: string;
    topicStableCodes: string[];
  }>;
};

function generateCalendarSlots(): CalendarSlot[] {
  return [
    { date: "2026-01-20", slotType: "class_day", label: "First class", source: "exemplar" },
    { date: "2026-01-22", slotType: "class_day", source: "exemplar" },
    { date: "2026-02-16", slotType: "holiday", label: "Presidents' Day", source: "exemplar" },
    { date: "2026-05-04", slotType: "finals", label: "Finals period", source: "exemplar" },
  ];
}

function generateStructure(): ExemplarStructure {
  return {
    course: {
      title: "Data Science Foundations",
      number: "DS 1XX",
      numberIsPlaceholder: true,
    },
    institution: {
      name: "Example University",
      shortName: "EXU",
    },
    academicCalendar: {
      name: "Spring 2026",
      academicYear: "2025-2026",
    },
    learningModules: [
      {
        stableCode: "LM-PROB",
        title: "Probability Foundations",
        description: "Probability, randomness, and simulation.",
        learningObjectives: [
          "Describe random events",
          "Apply simple probability rules",
          "Connect probability to simulation",
        ],
        topicStableCodes: ["TOPIC-PROB-1", "TOPIC-PROB-2"],
      },
      {
        stableCode: "LM-EMPTY",
        title: "Empty Learning Module",
        description: "Intentionally has no topics yet.",
        learningObjectives: [],
        topicStableCodes: [],
      },
    ],
    topics: [
      {
        stableCode: "TOPIC-PROB-1",
        learningModuleStableCode: "LM-PROB",
        title: "Probability 1",
        category: "Uncertainty",
        description: "Use probability language for uncertain events.",
      },
      {
        stableCode: "TOPIC-PROB-2",
        learningModuleStableCode: "LM-PROB",
        title: "Probability 2",
        category: "Uncertainty",
        description: "Use simulation to estimate uncertain outcomes.",
      },
      {
        stableCode: "TOPIC-BACKLOG-1",
        learningModuleStableCode: null,
        title: "Backlog Topic",
        category: "Unassigned",
        description: "Course-scoped topic not yet assigned to a Learning Module.",
      },
    ],
    term: {
      code: "S26",
      name: "Spring 2026",
      plannedLearningModuleStableCodes: ["LM-PROB"],
      deliveredLearningModuleStableCodes: ["LM-PROB"],
    },
    sessions: [
      {
        code: "lec-01",
        learningModuleStableCode: "LM-PROB",
        title: "Probability Foundations",
        sessionType: "lecture",
        date: "2026-01-20",
        topicStableCodes: ["TOPIC-PROB-1"],
      },
    ],
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "ds100-calendar.json"),
    `${JSON.stringify(generateCalendarSlots(), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(OUT, "ds100-structure.json"),
    `${JSON.stringify(generateStructure(), null, 2)}\n`,
  );
  console.log("Generated redesign DS-100 exemplar files.");
}

main();
