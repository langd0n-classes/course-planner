import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.assessmentSkill.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.coverage.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.module.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.term.deleteMany();
  await prisma.instructor.deleteMany();

  // ─── Instructors ─────────────────────────────────────
  const alice = await prisma.instructor.create({
    data: {
      name: "Alice Chen",
      email: "alice.chen@bu.edu",
    },
  });

  const bob = await prisma.instructor.create({
    data: {
      name: "Bob Martinez",
      email: "bob.martinez@bu.edu",
    },
  });

  console.log(`Created instructors: ${alice.name}, ${bob.name}`);

  // ─── Skills (global) ────────────────────────────────
  const skills = await Promise.all([
    prisma.skill.create({
      data: {
        code: "A01",
        category: "Foundations",
        description: "Write and execute Python expressions",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "A02",
        category: "Foundations",
        description: "Use variables to store and retrieve values",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "A03",
        category: "Foundations",
        description: "Use conditional logic (if/elif/else)",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "A04",
        category: "Foundations",
        description: "Write and call functions with parameters",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "B01",
        category: "Data Manipulation",
        description: "Load data into a pandas DataFrame",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "B02",
        category: "Data Manipulation",
        description: "Filter and select rows/columns in a DataFrame",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "B03",
        category: "Data Manipulation",
        description: "Handle missing data appropriately",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "C01",
        category: "Visualization",
        description: "Create basic plots with matplotlib",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "C02",
        category: "Visualization",
        description: "Choose appropriate chart types for data",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "D01",
        category: "Analysis",
        description: "Compute descriptive statistics",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "D02",
        category: "Analysis",
        description: "Perform basic hypothesis testing",
        isGlobal: true,
      },
    }),
    prisma.skill.create({
      data: {
        code: "E01",
        category: "Communication",
        description: "Write clear data analysis narratives",
        isGlobal: true,
      },
    }),
  ]);

  console.log(`Created ${skills.length} skills`);

  const skillMap = new Map(skills.map((s) => [s.code, s]));

  // ─── Term: Spring 2026 (Alice) ──────────────────────
  const s26 = await prisma.term.create({
    data: {
      instructorId: alice.id,
      code: "S26",
      name: "Spring 2026",
      startDate: new Date("2026-01-20"),
      endDate: new Date("2026-05-08"),
      courseCode: "DS-100",
      meetingPattern: {
        days: ["tuesday", "thursday"],
        lectureTime: "14:00-15:15",
        labDay: "wednesday",
        labTime: "10:00-11:50",
      },
      holidays: [
        { date: "2026-01-19", label: "MLK Jr. Day" },
        { date: "2026-02-16", label: "Presidents' Day" },
        {
          start: "2026-03-07",
          end: "2026-03-15",
          label: "Spring Recess",
        },
        { date: "2026-04-20", label: "Patriots' Day" },
      ],
    },
  });

  // Module 1: Programming Basics
  const mod1 = await prisma.module.create({
    data: {
      termId: s26.id,
      sequence: 0,
      code: "LM-01",
      title: "Programming Basics",
      description: "Introduction to Python programming fundamentals",
      learningObjectives: [
        "Write basic Python expressions",
        "Use variables and data types",
        "Apply conditional logic",
      ],
    },
  });

  const lec01 = await prisma.session.create({
    data: {
      moduleId: mod1.id,
      sequence: 0,
      sessionType: "lecture",
      code: "lec-01",
      title: "Welcome & Python Expressions",
      date: new Date("2026-01-20"),
      description: "Course overview, Python basics, REPL usage",
      format: "traditional",
    },
  });

  const lec02 = await prisma.session.create({
    data: {
      moduleId: mod1.id,
      sequence: 1,
      sessionType: "lecture",
      code: "lec-02",
      title: "Variables and Types",
      date: new Date("2026-01-22"),
      description: "Variable assignment, type system, string operations",
      format: "traditional",
    },
  });

  const lab01 = await prisma.session.create({
    data: {
      moduleId: mod1.id,
      sequence: 2,
      sessionType: "lab",
      code: "lab-01",
      title: "Python Fundamentals Lab",
      date: new Date("2026-01-21"),
      description: "Hands-on practice with expressions and variables",
      format: "traditional",
    },
  });

  const lec03 = await prisma.session.create({
    data: {
      moduleId: mod1.id,
      sequence: 3,
      sessionType: "lecture",
      code: "lec-03",
      title: "Conditionals and Functions",
      date: new Date("2026-01-27"),
      description: "if/elif/else, function definitions, parameters",
      format: "traditional",
    },
  });

  const lab02 = await prisma.session.create({
    data: {
      moduleId: mod1.id,
      sequence: 4,
      sessionType: "lab",
      code: "lab-02",
      title: "Functions & Control Flow Lab",
      date: new Date("2026-01-28"),
      description: "Practice writing functions and conditionals",
      format: "traditional",
    },
  });

  // Module 2: Tabular Data
  const mod2 = await prisma.module.create({
    data: {
      termId: s26.id,
      sequence: 1,
      code: "LM-02",
      title: "Tabular Data",
      description: "Working with structured data using pandas",
      learningObjectives: [
        "Load and inspect datasets",
        "Filter and transform DataFrames",
        "Handle missing values",
      ],
    },
  });

  const lec04 = await prisma.session.create({
    data: {
      moduleId: mod2.id,
      sequence: 0,
      sessionType: "lecture",
      code: "lec-04",
      title: "Introduction to pandas",
      date: new Date("2026-01-29"),
      description: "DataFrames, Series, loading CSV files",
      format: "traditional",
    },
  });

  const lec05 = await prisma.session.create({
    data: {
      moduleId: mod2.id,
      sequence: 1,
      sessionType: "lecture",
      code: "lec-05",
      title: "Data Selection & Filtering",
      date: new Date("2026-02-03"),
      description: "loc/iloc, boolean indexing, query method",
      format: "traditional",
    },
  });

  const lab03 = await prisma.session.create({
    data: {
      moduleId: mod2.id,
      sequence: 2,
      sessionType: "lab",
      code: "lab-03",
      title: "pandas Practice Lab",
      date: new Date("2026-02-04"),
      description: "Hands-on DataFrame manipulation",
      format: "traditional",
    },
  });

  const lec06 = await prisma.session.create({
    data: {
      moduleId: mod2.id,
      sequence: 3,
      sessionType: "lecture",
      code: "lec-06",
      title: "Missing Data & Data Cleaning",
      date: new Date("2026-02-05"),
      description: "NaN handling, dropna, fillna, data type conversion",
      format: "flipped",
    },
  });

  // Module 3: Visualization
  const mod3 = await prisma.module.create({
    data: {
      termId: s26.id,
      sequence: 2,
      code: "LM-03",
      title: "Visualization",
      description: "Creating effective data visualizations",
      learningObjectives: [
        "Create plots with matplotlib",
        "Choose appropriate chart types",
        "Communicate findings visually",
      ],
    },
  });

  const lec07 = await prisma.session.create({
    data: {
      moduleId: mod3.id,
      sequence: 0,
      sessionType: "lecture",
      code: "lec-07",
      title: "matplotlib Basics",
      date: new Date("2026-02-10"),
      description: "Figure, axes, basic plot types, customization",
      format: "traditional",
    },
  });

  const lec08 = await prisma.session.create({
    data: {
      moduleId: mod3.id,
      sequence: 1,
      sessionType: "lecture",
      code: "lec-08",
      title: "Choosing Visualizations",
      date: new Date("2026-02-12"),
      description:
        "Chart type selection, best practices, data-to-viz mapping",
      format: "traditional",
    },
  });

  // ─── Coverage entries ───────────────────────────────
  // Module 1 coverage
  await prisma.coverage.createMany({
    data: [
      // lec-01: Introduce A01, A02
      { sessionId: lec01.id, skillId: skillMap.get("A01")!.id, level: "introduced" },
      { sessionId: lec01.id, skillId: skillMap.get("A02")!.id, level: "introduced" },
      // lec-02: Practice A01, Introduce A02 more
      { sessionId: lec02.id, skillId: skillMap.get("A01")!.id, level: "practiced" },
      { sessionId: lec02.id, skillId: skillMap.get("A02")!.id, level: "practiced" },
      // lab-01: Practice A01, A02
      { sessionId: lab01.id, skillId: skillMap.get("A01")!.id, level: "practiced" },
      { sessionId: lab01.id, skillId: skillMap.get("A02")!.id, level: "practiced" },
      // lec-03: Introduce A03, A04
      { sessionId: lec03.id, skillId: skillMap.get("A03")!.id, level: "introduced" },
      { sessionId: lec03.id, skillId: skillMap.get("A04")!.id, level: "introduced" },
      // lab-02: Practice A03, A04
      { sessionId: lab02.id, skillId: skillMap.get("A03")!.id, level: "practiced" },
      { sessionId: lab02.id, skillId: skillMap.get("A04")!.id, level: "practiced" },

      // Module 2 coverage
      { sessionId: lec04.id, skillId: skillMap.get("B01")!.id, level: "introduced" },
      { sessionId: lec05.id, skillId: skillMap.get("B02")!.id, level: "introduced" },
      { sessionId: lec05.id, skillId: skillMap.get("B01")!.id, level: "practiced" },
      { sessionId: lab03.id, skillId: skillMap.get("B01")!.id, level: "practiced" },
      { sessionId: lab03.id, skillId: skillMap.get("B02")!.id, level: "practiced" },
      { sessionId: lec06.id, skillId: skillMap.get("B03")!.id, level: "introduced" },

      // Module 3 coverage
      { sessionId: lec07.id, skillId: skillMap.get("C01")!.id, level: "introduced" },
      { sessionId: lec08.id, skillId: skillMap.get("C02")!.id, level: "introduced" },
      { sessionId: lec08.id, skillId: skillMap.get("C01")!.id, level: "practiced" },
    ],
  });

  console.log("Created coverage entries");

  // ─── Assessments ────────────────────────────────────
  const gaie1 = await prisma.assessment.create({
    data: {
      termId: s26.id,
      code: "GAIE-01",
      title: "GenAI Exercise: Python Basics",
      assessmentType: "gaie",
      description: "Copy-paste stage: use AI to generate basic Python code",
      sessionId: lab02.id,
      dueDate: new Date("2026-01-30"),
      progressionStage: "copy-paste",
      skills: {
        create: [
          { skillId: skillMap.get("A01")!.id },
          { skillId: skillMap.get("A02")!.id },
        ],
      },
    },
  });

  const gaie2 = await prisma.assessment.create({
    data: {
      termId: s26.id,
      code: "GAIE-02",
      title: "GenAI Exercise: Data Wrangling",
      assessmentType: "gaie",
      description: "Modify stage: adapt AI-generated pandas code",
      sessionId: lab03.id,
      dueDate: new Date("2026-02-06"),
      progressionStage: "modify",
      skills: {
        create: [
          { skillId: skillMap.get("B01")!.id },
          { skillId: skillMap.get("B02")!.id },
        ],
      },
    },
  });

  await prisma.assessment.create({
    data: {
      termId: s26.id,
      code: "midterm",
      title: "Midterm Exam",
      assessmentType: "exam",
      description: "Covers modules 1-3",
      dueDate: new Date("2026-03-05"),
      skills: {
        create: [
          { skillId: skillMap.get("A01")!.id },
          { skillId: skillMap.get("A02")!.id },
          { skillId: skillMap.get("A03")!.id },
          { skillId: skillMap.get("B01")!.id },
          { skillId: skillMap.get("B02")!.id },
          { skillId: skillMap.get("C01")!.id },
        ],
      },
    },
  });

  await prisma.assessment.create({
    data: {
      termId: s26.id,
      code: "proj-01",
      title: "Data Analysis Project",
      assessmentType: "project",
      description: "End-to-end data analysis on a real dataset",
      dueDate: new Date("2026-04-24"),
      skills: {
        create: [
          { skillId: skillMap.get("B01")!.id },
          { skillId: skillMap.get("B02")!.id },
          { skillId: skillMap.get("C01")!.id },
          { skillId: skillMap.get("C02")!.id },
          { skillId: skillMap.get("D01")!.id },
          { skillId: skillMap.get("E01")!.id },
        ],
      },
    },
  });

  console.log("Created assessments");

  // ─── Sample Artifacts ───────────────────────────────
  await prisma.artifact.create({
    data: {
      parentType: "assessment",
      assessmentId: gaie1.id,
      artifactType: "notebook",
      filename: "GAIE01.ipynb",
      template: "gaie-notebook",
      metadata: { otterGrader: true },
    },
  });

  await prisma.artifact.create({
    data: {
      parentType: "assessment",
      assessmentId: gaie2.id,
      artifactType: "notebook",
      filename: "GAIE02.ipynb",
      template: "gaie-notebook",
      metadata: { otterGrader: true },
    },
  });

  await prisma.artifact.create({
    data: {
      parentType: "session",
      sessionId: lec01.id,
      artifactType: "slides",
      filename: "lec-01-slides.pdf",
      template: "lecture-slides",
    },
  });

  console.log("Created artifacts");

  // ─── Term: Fall 2025 (Bob — different course) ──────
  const f25 = await prisma.term.create({
    data: {
      instructorId: bob.id,
      code: "F25",
      name: "Fall 2025",
      startDate: new Date("2025-09-02"),
      endDate: new Date("2025-12-19"),
      courseCode: "CS-200",
      meetingPattern: {
        days: ["monday", "wednesday", "friday"],
        lectureTime: "09:00-09:50",
      },
      holidays: [
        { date: "2025-09-01", label: "Labor Day" },
        { date: "2025-10-13", label: "Indigenous People's Day" },
        {
          start: "2025-11-26",
          end: "2025-11-30",
          label: "Thanksgiving Recess",
        },
      ],
    },
  });

  const mod4 = await prisma.module.create({
    data: {
      termId: f25.id,
      sequence: 0,
      code: "M-01",
      title: "Algorithms Introduction",
      description: "Big-O notation, basic sorting and searching",
    },
  });

  await prisma.session.create({
    data: {
      moduleId: mod4.id,
      sequence: 0,
      sessionType: "lecture",
      code: "lec-01",
      title: "Algorithm Analysis",
      date: new Date("2025-09-03"),
      description: "Big-O notation, best/worst/average case",
      format: "traditional",
    },
  });

  await prisma.session.create({
    data: {
      moduleId: mod4.id,
      sequence: 1,
      sessionType: "lecture",
      code: "lec-02",
      title: "Sorting Algorithms",
      date: new Date("2025-09-05"),
      description: "Bubble sort, selection sort, insertion sort",
      format: "traditional",
    },
  });

  console.log(`Created Bob's term: ${f25.name}`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
