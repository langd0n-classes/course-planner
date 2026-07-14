/**
 * Deterministic realistic fixture for the B.2R activity-workspace prototype.
 * DS100-scale: ~150 topics, 10 LMs, 24 meetings per term, 13 coursework items.
 * No network or database — mutations are local state; this is an interaction spike.
 */

export type Id = string;

export type TopicCode = string;

export interface Topic {
  id: Id;
  title: string;
  /** Human-facing label, not a slug; suggested deterministically from title */
  code: TopicCode;
  category: string;
}

export type BehaviorFamily = "Meeting" | "Coursework" | "Assessment";

export interface ActivityType {
  id: Id;
  label: string;
  family: BehaviorFamily;
}

export interface LearningModule {
  id: Id;
  code: string;
  title: string;
  description: string;
}

export type MilestoneRole = "released" | "work-time" | "phase-released" | "review" | "due";

export interface Milestone {
  id: Id;
  role: MilestoneRole;
  /** Activity (meeting) this milestone is pinned near, or null for a standalone date */
  linkedActivityId: Id | null;
  /** Explicit date used when no linkedActivityId exists (e.g. assignment due dates) */
  date?: string | null;
  /** Optional exact time for standalone date milestones */
  time?: string | null;
  label: string;
}

export type ActivityKind = "meeting" | "assignment" | "project" | "exam";

export interface Activity {
  id: Id;
  kind: ActivityKind;
  title: string;
  typeId: Id;
  /** The single LM this card lives in on the board, or null = unassigned/cross-cutting */
  primaryLmId: Id | null;
  /** For meetings: ordinal within type (Lecture 1, Lab 3…) */
  ordinal: number | null;
  /** ISO date string for scheduled meetings */
  date: string | null;
  milestones: Milestone[];
  /** For projects: may span multiple LMs (scope only, not board placement) */
  scopeLmIds: Id[];
}

export type IpaAction = "I" | "P" | "A";

export interface TopicAction {
  id: Id;
  activityId: Id;
  topicId: Id;
  action: IpaAction;
}

export type CalendarSlotType = "class" | "holiday" | "break" | "finals" | "reading-day";

export interface CalendarSlot {
  date: string;
  type: CalendarSlotType;
  label: string;
}

export interface TermException {
  date: string;
  reason: string;
  /** "canceled" | "moved" | "added" */
  kind: string;
}

export interface FixtureData {
  topics: Topic[];
  learningModules: LearningModule[];
  activityTypes: ActivityType[];
  activities: Activity[];
  topicActions: TopicAction[];
  calendar: CalendarSlot[];
  termExceptions: TermException[];
  courseTitle: string;
  courseCode: string;
  termLabel: string;
  currentDate: string;
}

// ---------------------------------------------------------------------------
// Deterministic code suggestion: initials of significant words
// ---------------------------------------------------------------------------

export function suggestTopicCode(title: string): string {
  const stopWords = new Set(["a", "an", "the", "and", "or", "of", "in", "to", "for", "with", "on", "at", "by", "as"]);
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopWords.has(w.toLowerCase()));
  if (words.length === 0) return title.slice(0, 4).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words
    .slice(0, 4)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Topic bank — 150 topics across 8 categories
// ---------------------------------------------------------------------------

const RAW_TOPICS: [string, string][] = [
  // Data Fundamentals
  ["Data Types and Structures", "DTS"],
  ["Tabular Data", "TD"],
  ["Relational Data Models", "RDM"],
  ["Data Granularity", "DG"],
  ["Primary and Foreign Keys", "PFK"],
  ["Tidy Data Principles", "TDP"],
  ["Data Cleaning", "DC"],
  ["Missing Values", "MV"],
  ["Outlier Detection", "OD"],
  ["Data Transformation", "DTR"],
  ["String Manipulation", "SM"],
  ["Date and Time Data", "DTD"],
  ["Wide vs. Long Format", "WLF"],
  ["Data Provenance", "DP"],
  ["Schema Design", "SD"],
  ["Joins and Merges", "JM"],
  ["Aggregation", "AG"],
  ["GroupBy Operations", "GB"],
  ["Pivot Tables", "PT"],
  ["Data Deduplication", "DD"],

  // Probability & Statistics
  ["Random Variables", "RV"],
  ["Probability Distributions", "PD"],
  ["Expected Value", "EV"],
  ["Variance and Standard Deviation", "VSD"],
  ["Normal Distribution", "ND"],
  ["Binomial Distribution", "BD"],
  ["Poisson Distribution", "PoisD"],
  ["Central Limit Theorem", "CLT"],
  ["Law of Large Numbers", "LLN"],
  ["Conditional Probability", "CP"],
  ["Bayes' Theorem", "BT"],
  ["Joint and Marginal Distributions", "JMD"],
  ["Correlation vs. Causation", "CvC"],
  ["Covariance", "Cov"],
  ["Sampling Distributions", "SamD"],
  ["Confidence Intervals", "CI"],
  ["Hypothesis Testing", "HT"],
  ["p-values", "pV"],
  ["Multiple Testing Correction", "MTC"],
  ["Effect Size", "ES"],

  // Linear Algebra
  ["Vectors", "Vec"],
  ["Matrices", "Mat"],
  ["Matrix Multiplication", "MM"],
  ["Transpose", "Tr"],
  ["Dot Product", "Dot"],
  ["Linear Combinations", "LC"],
  ["Span and Basis", "SB"],
  ["Linear Independence", "LI"],
  ["Rank", "Rnk"],
  ["Null Space", "NS"],
  ["Eigenvalues and Eigenvectors", "EigV"],
  ["Singular Value Decomposition", "SVD"],
  ["Principal Component Analysis", "PCA"],
  ["Orthogonality", "Orth"],
  ["Projection", "Proj"],
  ["Norm", "Nrm"],
  ["Matrix Inverses", "MI"],
  ["Systems of Linear Equations", "SLE"],
  ["Least Squares", "LS"],
  ["Low-Rank Approximation", "LRA"],

  // Modeling & Regression
  ["Simple Linear Regression", "SLR"],
  ["Multiple Linear Regression", "MLR"],
  ["Model Assumptions", "MA"],
  ["Residuals", "Res"],
  ["R-squared", "R2"],
  ["Bias-Variance Tradeoff", "BVT"],
  ["Regularization", "Reg"],
  ["Ridge Regression", "RR"],
  ["Lasso Regression", "LasR"],
  ["Feature Engineering", "FE"],
  ["Polynomial Features", "PF"],
  ["Interaction Terms", "IT"],
  ["Model Selection", "MS"],
  ["Cross-Validation", "CV"],
  ["Train-Test Split", "TTS"],
  ["Overfitting", "OF"],
  ["Underfitting", "UF"],
  ["Prediction vs. Inference", "PvI"],
  ["Confidence vs. Prediction Intervals", "CPI"],
  ["Leverage and Influence", "LI2"],

  // Classification
  ["Logistic Regression", "LogR"],
  ["Decision Boundaries", "DB"],
  ["Confusion Matrix", "CM"],
  ["Precision and Recall", "PR"],
  ["ROC and AUC", "ROC"],
  ["k-Nearest Neighbors", "kNN"],
  ["Decision Trees", "DT"],
  ["Random Forests", "RF"],
  ["Gradient Boosting", "GB2"],
  ["Support Vector Machines", "SVM"],
  ["Naive Bayes", "NB"],
  ["Class Imbalance", "CI2"],
  ["Threshold Selection", "TS"],
  ["Calibration", "Cal"],
  ["Multiclass Classification", "MC"],

  // Clustering & Unsupervised
  ["k-Means Clustering", "kM"],
  ["Hierarchical Clustering", "HC"],
  ["DBSCAN", "DBS"],
  ["Silhouette Score", "SS"],
  ["Elbow Method", "EM"],
  ["Dimensionality Reduction", "DR"],
  ["t-SNE", "tSNE"],
  ["UMAP", "UMAP"],
  ["Anomaly Detection", "AD"],
  ["Association Rules", "AR"],

  // Visualization
  ["Grammar of Graphics", "GoG"],
  ["Scatter Plots", "Scat"],
  ["Histograms", "Hist"],
  ["Box Plots", "Box"],
  ["Bar Charts", "Bar"],
  ["Line Charts", "Line"],
  ["Heatmaps", "Heat"],
  ["Faceting", "Fac"],
  ["Color Encoding", "CE"],
  ["Axis Scales", "AS"],
  ["Overplotting", "OP"],
  ["Interactive Visualization", "IV"],
  ["Perceptual Principles", "PP"],
  ["Misleading Visualizations", "MisV"],
  ["Communication-First Charts", "CFC"],

  // Computation & Tools
  ["Python Basics", "PyB"],
  ["NumPy Arrays", "NumP"],
  ["Pandas DataFrames", "Pand"],
  ["Indexing and Slicing", "IS"],
  ["Boolean Indexing", "BI"],
  ["Apply and Map", "AppM"],
  ["Vectorized Operations", "VO"],
  ["Memory and Performance", "MP"],
  ["File I/O", "FIO"],
  ["SQL Queries", "SQL"],
  ["APIs and JSON", "AJ"],
  ["Web Scraping", "WS"],
  ["Regular Expressions", "RE"],
  ["Command Line Basics", "CLB"],
  ["Version Control with Git", "VCG"],
  ["Reproducibility", "Repr"],
  ["Jupyter Notebooks", "JN"],
  ["Virtual Environments", "VE"],
  ["Testing Code", "TC"],
  ["Debugging", "Dbg"],

  // Inference & Ethics
  ["Sampling Bias", "SamB"],
  ["Confounding Variables", "ConfV"],
  ["Simpson's Paradox", "SimP"],
  ["Ecological Fallacy", "EF"],
  ["Causal Inference Basics", "CIB"],
  ["Observational vs. Experimental", "OvE"],
  ["A/B Testing", "ABT"],
  ["Data Ethics Overview", "DEO"],
  ["Fairness and Bias in ML", "FBM"],
  ["Privacy and Anonymization", "PA"],
];

function buildTopics(): Topic[] {
  return RAW_TOPICS.map(([title, code], i) => ({
    id: `t${String(i + 1).padStart(3, "0")}`,
    title,
    code,
    category: getCategory(i),
  }));
}

function getCategory(idx: number): string {
  const cats = [
    "Data Fundamentals",
    "Probability & Statistics",
    "Linear Algebra",
    "Modeling & Regression",
    "Classification",
    "Clustering & Unsupervised",
    "Visualization",
    "Computation & Tools",
    "Inference & Ethics",
  ];
  if (idx < 20) return cats[0];
  if (idx < 40) return cats[1];
  if (idx < 60) return cats[2];
  if (idx < 80) return cats[3];
  if (idx < 95) return cats[4];
  if (idx < 105) return cats[5];
  if (idx < 120) return cats[6];
  if (idx < 140) return cats[7];
  return cats[8];
}

// ---------------------------------------------------------------------------
// Learning Modules
// ---------------------------------------------------------------------------

const LMS: LearningModule[] = [
  { id: "lm01", code: "LM01", title: "Data Wrangling", description: "Collecting, cleaning, and transforming tabular data." },
  { id: "lm02", code: "LM02", title: "Exploratory Data Analysis", description: "Summarizing and visualizing data to build intuition." },
  { id: "lm03", code: "LM03", title: "Probability Foundations", description: "Random variables, distributions, and the central limit theorem." },
  { id: "lm04", code: "LM04", title: "Statistical Inference", description: "Estimation, hypothesis testing, and confidence intervals." },
  { id: "lm05", code: "LM05", title: "Linear Algebra for Data", description: "Vectors, matrices, and their role in data transformations." },
  { id: "lm06", code: "LM06", title: "Regression Modeling", description: "Simple, multiple, and regularized linear regression." },
  { id: "lm07", code: "LM07", title: "Classification", description: "Logistic regression, decision trees, and evaluation metrics." },
  { id: "lm08", code: "LM08", title: "Unsupervised Learning", description: "Clustering, dimensionality reduction, and anomaly detection." },
  { id: "lm09", code: "LM09", title: "Visualization Principles", description: "Effective, ethical chart design grounded in perception research." },
  { id: "lm10", code: "LM10", title: "Ethics and Inference", description: "Bias, fairness, causal reasoning, and responsible practice." },
];

// ---------------------------------------------------------------------------
// Activity types
// ---------------------------------------------------------------------------

const ACTIVITY_TYPES: ActivityType[] = [
  { id: "at-lecture", label: "Lecture", family: "Meeting" },
  { id: "at-lab", label: "Lab", family: "Meeting" },
  { id: "at-discussion", label: "Discussion", family: "Meeting" },
  { id: "at-assignment", label: "Assignment", family: "Coursework" },
  { id: "at-project", label: "Project", family: "Coursework" },
  { id: "at-exam", label: "Exam", family: "Assessment" },
];

// ---------------------------------------------------------------------------
// Calendar — Spring semester Mon/Wed/Fri lectures + Mon labs
// Week 1: 2026-01-20 (first class) … through finals
// ---------------------------------------------------------------------------

function classDate(weekOffset: number, dayOffset: number): string {
  // Week 0, day 0 = Tue Jan 20, 2026
  const base = new Date("2026-01-20T00:00:00Z");
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + weekOffset * 7 + dayOffset);
  return d.toISOString().slice(0, 10);
}

// day offsets: Tue=0, Thu=2 for MWF-like spacing
// We'll do T/Th lectures + Mon labs for 13 weeks
function buildCalendar(): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  for (let w = 0; w < 13; w++) {
    const tue = classDate(w, 0);
    const thu = classDate(w, 2);
    const satLab = classDate(w, 5); // Sat as "lab section" stand-in
    if (w === 7) {
      // Spring break
      slots.push({ date: tue, type: "break", label: "Spring Break" });
      slots.push({ date: thu, type: "break", label: "Spring Break" });
      continue;
    }
    slots.push({ date: tue, type: "class", label: "Lecture" });
    slots.push({ date: thu, type: "class", label: "Lecture" });
    slots.push({ date: satLab, type: "class", label: "Lab" });
  }
  // Reading day
  slots.push({ date: classDate(13, 1), type: "reading-day", label: "Reading Day" });
  // Finals period
  for (let i = 2; i <= 6; i++) {
    slots.push({ date: classDate(13, i), type: "finals", label: "Finals Period" });
  }
  // Substitute Monday (Week 3 Tuesday canceled, Monday added)
  slots.push({ date: classDate(3, -1), type: "class", label: "Substitute Monday Lecture" });
  return slots;
}

// ---------------------------------------------------------------------------
// Term exceptions
// ---------------------------------------------------------------------------

const TERM_EXCEPTIONS: TermException[] = [
  { date: classDate(3, 0), reason: "Instructor conference travel — lecture moved to substitute Monday", kind: "moved" },
  { date: classDate(9, 2), reason: "Snow cancellation — content redistributed to following Thursday", kind: "canceled" },
  { date: classDate(12, 5), reason: "Oral interview lab — special finals-period format, not ordinary lab", kind: "added" },
];

// ---------------------------------------------------------------------------
// Activities — meetings and coursework
// ---------------------------------------------------------------------------

function buildActivities(): Activity[] {
  const activities: Activity[] = [];

  // --- Lectures L01–L24 ---
  const lectureDates = buildCalendar()
    .filter((s) => s.type === "class" && s.label.includes("Lecture"))
    .map((s) => s.date)
    .sort();

  const lmForLecture: (Id | null)[] = [
    "lm01", "lm01", // L01-L02
    "lm02", "lm02", // L03-L04
    "lm03", "lm03", // L05-L06
    "lm04", "lm04", // L07-L08
    "lm05", "lm05", // L09-L10
    "lm06", "lm06", "lm06", // L11-L13
    "lm07", "lm07", "lm07", // L14-L16
    "lm08", "lm08", // L17-L18
    "lm09", "lm09", // L19-L20
    "lm10", "lm10", // L21-L22
    null,           // L23 — exam review, unassigned
    null,           // L24 — oral interviews, unassigned
  ];

  const lectureTitles = [
    "Course Overview & Python Setup",
    "Pandas and Tabular Data",
    "EDA: Distributions and Summary Statistics",
    "Visualization Fundamentals",
    "Probability Basics",
    "Distributions and the CLT",
    "Estimation and Confidence Intervals",
    "Hypothesis Testing",
    "Vectors and Matrices",
    "SVD and PCA",
    "Simple Linear Regression",
    "Multiple Regression and Feature Engineering",
    "Regularization: Ridge and Lasso",
    "Logistic Regression",
    "Decision Trees and Random Forests",
    "Classification Evaluation",
    "k-Means and Hierarchical Clustering",
    "Dimensionality Reduction in Practice",
    "Grammar of Graphics",
    "Communicating with Charts",
    "Bias, Fairness, and Ethics",
    "Causal Inference",
    "Exam 2 Review",
    "Oral Interview Prep & Course Wrap-Up",
  ];

  for (let i = 0; i < Math.min(24, lectureDates.length, lmForLecture.length); i++) {
    activities.push({
      id: `lec${String(i + 1).padStart(2, "0")}`,
      kind: "meeting",
      title: lectureTitles[i] ?? `Lecture ${i + 1}`,
      typeId: "at-lecture",
      primaryLmId: lmForLecture[i] ?? null,
      ordinal: i + 1,
      date: lectureDates[i] ?? null,
      milestones: [],
      scopeLmIds: [],
    });
  }

  // --- Labs Lab01–Lab12 ---
  const labDates = buildCalendar()
    .filter((s) => s.type === "class" && s.label.includes("Lab"))
    .map((s) => s.date)
    .sort();

  const lmForLab: (Id | null)[] = [
    "lm01", "lm01", "lm02", "lm03", "lm04", "lm05",
    "lm06", "lm07", "lm07", "lm08", "lm09", "lm10",
  ];
  const labTitles = [
    "Data Cleaning Lab",
    "Wrangling with Pandas",
    "EDA and Plotting Lab",
    "Probability Simulation Lab",
    "Bootstrap and Sampling Lab",
    "Matrix Operations Lab",
    "Regression Lab",
    "Logistic Regression Lab",
    "Random Forest Lab",
    "Clustering Lab",
    "Visualization Critique Lab",
    "Oral Interview Lab (Finals)",
  ];

  for (let i = 0; i < Math.min(12, labDates.length, lmForLab.length); i++) {
    activities.push({
      id: `lab${String(i + 1).padStart(2, "0")}`,
      kind: "meeting",
      title: labTitles[i] ?? `Lab ${i + 1}`,
      typeId: "at-lab",
      primaryLmId: lmForLab[i] ?? null,
      ordinal: i + 1,
      date: labDates[i] ?? null,
      milestones: [],
      scopeLmIds: [],
    });
  }

  // --- Assignments A01–A08 ---
  const assignmentData: Array<{ title: string; lmId: Id | null; dueDate: string }> = [
    { title: "Assignment 1: Data Cleaning", lmId: "lm01", dueDate: classDate(2, 2) },
    { title: "Assignment 2: EDA Report", lmId: "lm02", dueDate: classDate(4, 2) },
    { title: "Assignment 3: Probability Problems", lmId: "lm03", dueDate: classDate(6, 2) },
    { title: "Assignment 4: Inference & CI", lmId: "lm04", dueDate: classDate(8, 2) },
    { title: "Assignment 5: Linear Algebra", lmId: "lm05", dueDate: classDate(10, 2) },
    { title: "Assignment 6: Regression", lmId: "lm06", dueDate: classDate(11, 2) },
    { title: "Assignment 7: Classification", lmId: "lm07", dueDate: classDate(12, 2) },
    { title: "Assignment 8: Ethics Cases", lmId: "lm10", dueDate: classDate(13, 0) },
  ];
  for (let i = 0; i < assignmentData.length; i++) {
    const a = assignmentData[i];
    activities.push({
      id: `asgn${String(i + 1).padStart(2, "0")}`,
      kind: "assignment",
      title: a.title,
      typeId: "at-assignment",
      primaryLmId: a.lmId,
      ordinal: i + 1,
      date: null,
      milestones: [
        { id: `asgn${i + 1}-due`, role: "due", linkedActivityId: null, date: a.dueDate, label: `Due ${a.dueDate}` },
      ],
      scopeLmIds: [],
    });
  }

  // --- Project 1 — cross-cutting, multi-milestone ---
  // Released during L11, work time during Lab07, phase-released during L14, due in the morning of L18
  const project1DueDate = classDate(9, 2);
  activities.push({
    id: "proj01",
    kind: "project",
    title: "Project 1: Predictive Model",
    typeId: "at-project",
    primaryLmId: null, // cross-cutting
    ordinal: 1,
    date: null,
    milestones: [
      { id: "proj01-released", role: "released", linkedActivityId: "lec11", label: "Released during L11" },
      { id: "proj01-worktime", role: "work-time", linkedActivityId: "lab07", label: "Work time in Lab 7" },
      { id: "proj01-phase", role: "phase-released", linkedActivityId: "lec14", label: "Phase 2 released during L14" },
      { id: "proj01-due", role: "due", linkedActivityId: null, date: project1DueDate, time: "09:00", label: "Due before L18" },
    ],
    scopeLmIds: ["lm06", "lm07"],
  });

  // --- Exam 1 ---
  activities.push({
    id: "exam01",
    kind: "exam",
    title: "Midterm Exam",
    typeId: "at-exam",
    primaryLmId: null,
    ordinal: 1,
    date: classDate(9, 0),
    milestones: [
      { id: "exam01-review", role: "review", linkedActivityId: "lec14", label: "Review in L14" },
    ],
    scopeLmIds: ["lm01", "lm02", "lm03", "lm04", "lm05"],
  });

  // --- Exam 2 (oral interviews during finals) ---
  activities.push({
    id: "exam02",
    kind: "exam",
    title: "Final Oral Interview",
    typeId: "at-exam",
    primaryLmId: null,
    ordinal: 2,
    date: classDate(13, 5),
    milestones: [
      { id: "exam02-review", role: "review", linkedActivityId: "lec23", label: "Review in L23" },
    ],
    scopeLmIds: ["lm06", "lm07", "lm08", "lm09", "lm10"],
  });

  return activities;
}

// ---------------------------------------------------------------------------
// Topic actions — I/P/A connections between activities and topics
// Includes one intentional duplicate: t001 (Data Types) I appears twice (L01 and L02)
// ---------------------------------------------------------------------------

function buildTopicActions(): TopicAction[] {
  const actions: TopicAction[] = [];
  let seq = 1;
  function ta(actId: Id, topicId: Id, action: IpaAction): TopicAction {
    return { id: `ta${String(seq++).padStart(4, "0")}`, activityId: actId, topicId, action };
  }

  // L01 — Course Overview & Python Setup
  actions.push(ta("lec01", "t001", "I")); // Data Types — DUPLICATE I (also in L02)
  actions.push(ta("lec01", "t121", "I")); // Python Basics
  actions.push(ta("lec01", "t122", "I")); // NumPy Arrays
  actions.push(ta("lec01", "t127", "I")); // Jupyter Notebooks

  // L02 — Pandas and Tabular Data
  actions.push(ta("lec02", "t001", "I")); // Data Types — INTENTIONAL DUPLICATE of L01 I
  actions.push(ta("lec02", "t002", "I")); // Tabular Data
  actions.push(ta("lec02", "t123", "I")); // Pandas DataFrames
  actions.push(ta("lec02", "t124", "I")); // Indexing and Slicing

  // L03 — EDA
  actions.push(ta("lec03", "t007", "I")); // Data Cleaning
  actions.push(ta("lec03", "t008", "P")); // Missing Values
  actions.push(ta("lec03", "t009", "P")); // Outlier Detection

  // L04 — Visualization Fundamentals
  actions.push(ta("lec04", "t107", "I")); // Histograms
  actions.push(ta("lec04", "t108", "I")); // Box Plots
  actions.push(ta("lec04", "t106", "I")); // Scatter Plots
  actions.push(ta("lec04", "t101", "I")); // Grammar of Graphics

  // L05 — Probability Basics
  actions.push(ta("lec05", "t021", "I")); // Random Variables
  actions.push(ta("lec05", "t022", "I")); // Probability Distributions
  actions.push(ta("lec05", "t030", "I")); // Conditional Probability

  // L06 — Distributions and CLT
  actions.push(ta("lec06", "t025", "I")); // Normal Distribution
  actions.push(ta("lec06", "t028", "I")); // Central Limit Theorem
  actions.push(ta("lec06", "t023", "P")); // Expected Value
  actions.push(ta("lec06", "t024", "P")); // Variance

  // L07 — Estimation and CI
  actions.push(ta("lec07", "t035", "I")); // Sampling Distributions
  actions.push(ta("lec07", "t036", "I")); // Confidence Intervals

  // L08 — Hypothesis Testing
  actions.push(ta("lec08", "t037", "I")); // Hypothesis Testing
  actions.push(ta("lec08", "t038", "I")); // p-values
  actions.push(ta("lec08", "t039", "P")); // Multiple Testing

  // L09 — Vectors and Matrices
  actions.push(ta("lec09", "t041", "I")); // Vectors
  actions.push(ta("lec09", "t042", "I")); // Matrices
  actions.push(ta("lec09", "t043", "I")); // Matrix Multiplication

  // L10 — SVD and PCA
  actions.push(ta("lec10", "t051", "I")); // Eigenvalues
  actions.push(ta("lec10", "t052", "I")); // SVD
  actions.push(ta("lec10", "t053", "I")); // PCA

  // L11 — Simple Linear Regression
  actions.push(ta("lec11", "t061", "I")); // SLR
  actions.push(ta("lec11", "t063", "I")); // Model Assumptions
  actions.push(ta("lec11", "t059", "P")); // Least Squares

  // L12 — Multiple Regression
  actions.push(ta("lec12", "t062", "I")); // MLR
  actions.push(ta("lec12", "t070", "I")); // Feature Engineering
  actions.push(ta("lec12", "t065", "I")); // Bias-Variance Tradeoff

  // L13 — Regularization
  actions.push(ta("lec13", "t066", "I")); // Regularization
  actions.push(ta("lec13", "t067", "I")); // Ridge
  actions.push(ta("lec13", "t068", "I")); // Lasso
  actions.push(ta("lec13", "t073", "P")); // Cross-Validation

  // L14 — Logistic Regression
  actions.push(ta("lec14", "t081", "I")); // Logistic Regression
  actions.push(ta("lec14", "t082", "I")); // Decision Boundaries
  actions.push(ta("lec14", "t083", "I")); // Confusion Matrix

  // L15 — Decision Trees
  actions.push(ta("lec15", "t086", "I")); // k-NN
  actions.push(ta("lec15", "t087", "I")); // Decision Trees
  actions.push(ta("lec15", "t088", "I")); // Random Forests

  // L16 — Classification Evaluation
  actions.push(ta("lec16", "t083", "P")); // Confusion Matrix P
  actions.push(ta("lec16", "t084", "P")); // Precision/Recall
  actions.push(ta("lec16", "t085", "I")); // ROC/AUC
  actions.push(ta("lec16", "t062", "A")); // MLR — assessed via proj01

  // L17 — Clustering
  actions.push(ta("lec17", "t096", "I")); // k-Means
  actions.push(ta("lec17", "t097", "I")); // Hierarchical Clustering
  actions.push(ta("lec17", "t099", "I")); // Silhouette

  // L18 — Dimensionality Reduction in Practice
  actions.push(ta("lec18", "t053", "P")); // PCA — practiced again
  actions.push(ta("lec18", "t103", "I")); // t-SNE
  actions.push(ta("lec18", "t104", "I")); // UMAP

  // L19 — Grammar of Graphics
  actions.push(ta("lec19", "t101", "P")); // Grammar of Graphics P
  actions.push(ta("lec19", "t115", "I")); // Color Encoding
  actions.push(ta("lec19", "t116", "I")); // Axis Scales

  // L20 — Communicating with Charts
  actions.push(ta("lec20", "t120", "I")); // Communication-First Charts
  actions.push(ta("lec20", "t119", "P")); // Misleading Visualizations

  // L21 — Bias, Fairness, Ethics
  actions.push(ta("lec21", "t141", "I")); // Sampling Bias
  actions.push(ta("lec21", "t145", "I")); // Data Ethics
  actions.push(ta("lec21", "t146", "I")); // Fairness/Bias in ML

  // L22 — Causal Inference
  actions.push(ta("lec22", "t143", "I")); // Confounding
  actions.push(ta("lec22", "t144", "I")); // Simpson's Paradox
  actions.push(ta("lec22", "t148", "I")); // Observational vs Experimental

  // Assignment 1
  actions.push(ta("asgn01", "t007", "P")); // Data Cleaning P
  actions.push(ta("asgn01", "t008", "P")); // Missing Values P
  actions.push(ta("asgn01", "t010", "P")); // Data Transformation P

  // Assignment 2
  actions.push(ta("asgn02", "t009", "A")); // Outlier Detection A
  actions.push(ta("asgn02", "t107", "P")); // Histograms P

  // Project 1
  actions.push(ta("proj01", "t061", "A")); // SLR A
  actions.push(ta("proj01", "t062", "A")); // MLR A
  actions.push(ta("proj01", "t066", "A")); // Regularization A
  actions.push(ta("proj01", "t081", "A")); // Logistic Regression A

  // Midterm Exam
  actions.push(ta("exam01", "t021", "A")); // Random Variables A
  actions.push(ta("exam01", "t028", "A")); // CLT A
  actions.push(ta("exam01", "t036", "A")); // CI A
  actions.push(ta("exam01", "t037", "A")); // HT A
  actions.push(ta("exam01", "t052", "A")); // SVD A

  // Final Oral Interview
  actions.push(ta("exam02", "t083", "A")); // Confusion Matrix A
  actions.push(ta("exam02", "t085", "A")); // ROC A
  actions.push(ta("exam02", "t096", "A")); // k-Means A
  actions.push(ta("exam02", "t145", "A")); // Data Ethics A
  actions.push(ta("exam02", "t146", "A")); // Fairness A

  return actions;
}

// ---------------------------------------------------------------------------
// Build and export the complete fixture
// ---------------------------------------------------------------------------

export function buildFixture(): FixtureData {
  return {
    courseTitle: "Data Science 100",
    courseCode: "DS 100",
    termLabel: "Spring 2026",
    currentDate: "2026-02-18", // mid-LM05: L10 just happened, L11 (regression) is next
    topics: buildTopics(),
    learningModules: LMS,
    activityTypes: ACTIVITY_TYPES,
    activities: buildActivities(),
    topicActions: buildTopicActions(),
    calendar: buildCalendar(),
    termExceptions: TERM_EXCEPTIONS,
  };
}

// ---------------------------------------------------------------------------
// Helpers for prototype state queries
// ---------------------------------------------------------------------------

export function getDuplicateTopicActions(
  topicActions: TopicAction[],
): Map<string, TopicAction[]> {
  const groups = new Map<string, TopicAction[]>();
  for (const ta of topicActions) {
    const key = `${ta.topicId}:${ta.action}`;
    const list = groups.get(key) ?? [];
    list.push(ta);
    groups.set(key, list);
  }
  const result = new Map<string, TopicAction[]>();
  for (const [key, list] of groups) {
    if (list.length > 1) result.set(key, list);
  }
  return result;
}

export function getActivitiesForLm(activities: Activity[], lmId: Id | null): Activity[] {
  return activities.filter((a) => a.primaryLmId === lmId);
}

export function getPrimaryLmViolations(activities: Activity[]): Activity[] {
  // Returns activities with multiple primaryLmId (should be impossible by design; this validates invariant)
  // The fixture enforces at-most-one primaryLmId per activity, but we check for null safety
  return activities.filter(
    (a) => a.primaryLmId !== null && a.primaryLmId !== undefined && typeof a.primaryLmId !== "string",
  );
}

export function getUpcomingItems(
  activities: Activity[],
  currentDate: string,
  limit = 12,
): Array<{ type: "meeting" | "milestone"; label: string; date: string; activityId: Id; role?: MilestoneRole; time?: string | null }> {
  const items: Array<{ type: "meeting" | "milestone"; label: string; date: string; activityId: Id; role?: MilestoneRole; time?: string | null }> = [];

  for (const act of activities) {
    if (act.date && act.date >= currentDate && act.kind === "meeting") {
      items.push({ type: "meeting", label: act.title, date: act.date, activityId: act.id });
    }
    for (const ms of act.milestones) {
      const linkedAct = activities.find((a) => a.id === ms.linkedActivityId);
      const msDate = linkedAct?.date ?? ms.date ?? null;
      if (msDate !== null && msDate >= currentDate) {
        items.push({
          type: "milestone",
          label: ms.label,
          date: msDate,
          activityId: act.id,
          role: ms.role,
          time: ms.linkedActivityId === null ? ms.time ?? undefined : undefined,
        });
      }
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}
