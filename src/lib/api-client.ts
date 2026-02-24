/** Typed fetch wrapper for client components */

const BASE = "";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

async function requestRaw<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

// ─── Shared Types ───────────────────────────────────────

export interface Instructor {
  id: string;
  name: string;
  email: string;
}

export interface Term {
  id: string;
  code: string;
  name: string;
  courseCode: string;
  startDate: string;
  endDate: string;
  meetingPattern: { days?: string[] } | null;
  instructorId: string;
  clonedFromId?: string | null;
  instructor?: Instructor;
  modules?: Module[];
  assessments?: Assessment[];
  _count?: Record<string, number>;
}

export interface Module {
  id: string;
  termId: string;
  sequence: number;
  code: string;
  title: string;
  description: string | null;
  learningObjectives: string[];
  notes: string | null;
  sessions?: Session[];
}

export interface Session {
  id: string;
  moduleId: string;
  sequence: number;
  sessionType: "lecture" | "lab";
  code: string;
  title: string;
  date: string | null;
  description: string | null;
  format?: string | null;
  notes?: string | null;
  status: "scheduled" | "canceled" | "moved";
  canceledAt: string | null;
  canceledReason: string | null;
  module?: Module;
  coverages?: Coverage[];
  // Move endpoint may return impact info
  impact?: { affectedSkillIds: string[]; newViolations: Array<{ type: string; message: string }> } | null;
}

export interface Skill {
  id: string;
  code: string;
  category: string;
  description: string;
  isGlobal: boolean;
  termId: string | null;
  coverages?: Coverage[];
  assessmentSkills?: Array<{ assessment: Assessment }>;
  _count?: Record<string, number>;
}

export interface Coverage {
  id: string;
  sessionId: string;
  skillId: string;
  level: "introduced" | "practiced" | "assessed";
  notes: string | null;
  redistributedFrom?: string | null;
  skill?: Skill;
  session?: Session;
}

export interface Assessment {
  id: string;
  termId: string;
  code: string;
  title: string;
  assessmentType: "gaie" | "assignment" | "exam" | "project";
  description: string | null;
  progressionStage: string | null;
  dueDate: string | null;
  sessionId?: string | null;
  session?: Session | null;
  skills?: Array<{ skill: Skill }>;
}

export interface CalendarSlot {
  id: string;
  termId: string;
  date: string;
  dayOfWeek: string;
  slotType: "class_day" | "holiday" | "finals" | "break_day";
  label: string | null;
}

export interface ImportResult {
  created?: number;
  updated?: number;
  total?: number;
  modules?: number;
  sessions?: number;
  skills?: number;
  coverages?: number;
  assessments?: number;
}

export interface WhatIfImpact {
  canceledSessionId: string;
  affectedCoverages: Array<{ skillId: string; level: string }>;
  atRiskSkills: Array<{
    skillId: string;
    skillCode: string;
    level: string;
    uniqueCoverage: boolean;
    otherSessions: Array<{ sessionId: string; sessionCode: string; level: string }>;
  }>;
  healthBefore: { totalSkills: number; fullyCovered: number; fullyIntroduced: number };
  healthAfter: { totalSkills: number; fullyCovered: number; fullyIntroduced: number };
  newViolations: Array<{ type: string; message: string }>;
}

export interface ScenarioComparison {
  scenarioA: WhatIfImpact;
  scenarioB: WhatIfImpact;
}

export interface ValidationItem {
  type: string;
  message: string;
  skillId?: string;
  sessionId?: string;
  moduleId?: string;
}

export interface ImpactReport {
  termId: string;
  errors: ValidationItem[];
  warnings: ValidationItem[];
  info: ValidationItem[];
  summary: {
    totalSkills: number;
    totalSessions: number;
    totalCoverageEntries: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

// ─── API Client ─────────────────────────────────────────

export const api = {
  // Instructors
  getInstructors: () => request<Instructor[]>("/api/instructors"),

  // Terms
  getTerms: (instructorId?: string) =>
    request<Term[]>(
      `/api/terms${instructorId ? `?instructorId=${instructorId}` : ""}`,
    ),
  getTerm: (id: string) => request<Term>(`/api/terms/${id}`),
  createTerm: (data: Partial<Term>) =>
    request<Term>("/api/terms", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTerm: (id: string, data: Partial<Term>) =>
    request<Term>(`/api/terms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTerm: (id: string) =>
    request<{ deleted: boolean }>(`/api/terms/${id}`, { method: "DELETE" }),
  cloneTerm: (id: string, data: { code: string; name: string; startDate: string; endDate: string }) =>
    request<Term>(`/api/terms/${id}/clone`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTermImpact: (id: string) =>
    request<ImpactReport>(`/api/terms/${id}/impact`),

  // Modules
  getModules: (termId?: string) =>
    request<Module[]>(
      `/api/modules${termId ? `?termId=${termId}` : ""}`,
    ),
  getModule: (id: string) => request<Module>(`/api/modules/${id}`),
  createModule: (data: Partial<Module>) =>
    request<Module>("/api/modules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateModule: (id: string, data: Partial<Module>) =>
    request<Module>(`/api/modules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteModule: (id: string) =>
    request<{ deleted: boolean }>(`/api/modules/${id}`, { method: "DELETE" }),

  // Skills
  getSkill: (id: string) => request<Skill>(`/api/skills/${id}`),
  getSkills: (termId?: string) =>
    request<Skill[]>(
      `/api/skills${termId ? `?termId=${termId}` : ""}`,
    ),
  createSkill: (data: Partial<Skill>) =>
    request<Skill>("/api/skills", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSkill: (id: string, data: Partial<Skill>) =>
    request<Skill>(`/api/skills/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSkill: (id: string) =>
    request<{ deleted: boolean }>(`/api/skills/${id}`, { method: "DELETE" }),

  // Sessions
  getSession: (id: string) => request<Session>(`/api/sessions/${id}`),
  getSessions: (params?: { moduleId?: string; termId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.moduleId) qs.set("moduleId", params.moduleId);
    if (params?.termId) qs.set("termId", params.termId);
    const q = qs.toString();
    return request<Session[]>(`/api/sessions${q ? `?${q}` : ""}`);
  },
  createSession: (data: Partial<Session>) =>
    request<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSession: (id: string, data: Partial<Session>) =>
    request<Session>(`/api/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSession: (id: string) =>
    request<{ deleted: boolean }>(`/api/sessions/${id}`, { method: "DELETE" }),
  moveSession: (id: string, data: { date?: string | null; moduleId?: string; sequence?: number }) =>
    request<Session>(`/api/sessions/${id}/move`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelSession: (id: string, data: { reason?: string; redistributions?: Array<{ skillId: string; level: string; targetSessionId: string }>; dryRun?: boolean; force?: boolean }) =>
    request<Session | { valid: boolean; violations: Array<{ type: string; message: string }> }>(`/api/sessions/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getSessionWhatIf: (id: string) =>
    request<WhatIfImpact>(`/api/sessions/${id}/whatif`),

  // Coverage
  getCoverages: (params?: {
    sessionId?: string;
    skillId?: string;
    termId?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.sessionId) qs.set("sessionId", params.sessionId);
    if (params?.skillId) qs.set("skillId", params.skillId);
    if (params?.termId) qs.set("termId", params.termId);
    const q = qs.toString();
    return request<Coverage[]>(`/api/coverages${q ? `?${q}` : ""}`);
  },
  createCoverage: (data: Partial<Coverage>) =>
    request<Coverage>("/api/coverages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCoverage: (id: string) =>
    request<{ deleted: boolean }>(`/api/coverages/${id}`, { method: "DELETE" }),

  // Assessments
  getAssessments: (termId?: string) =>
    request<Assessment[]>(
      `/api/assessments${termId ? `?termId=${termId}` : ""}`,
    ),
  createAssessment: (data: Partial<Assessment> & { skillIds?: string[] }) =>
    request<Assessment>("/api/assessments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAssessment: (id: string, data: Partial<Assessment>) =>
    request<Assessment>(`/api/assessments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteAssessment: (id: string) =>
    request<{ deleted: boolean }>(`/api/assessments/${id}`, { method: "DELETE" }),

  // Artifacts
  getArtifacts: (params?: {
    parentType?: string;
    sessionId?: string;
    assessmentId?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.parentType) qs.set("parentType", params.parentType);
    if (params?.sessionId) qs.set("sessionId", params.sessionId);
    if (params?.assessmentId) qs.set("assessmentId", params.assessmentId);
    const q = qs.toString();
    return request<unknown[]>(`/api/artifacts${q ? `?${q}` : ""}`);
  },
  createArtifact: (data: unknown) =>
    request<unknown>("/api/artifacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Calendar
  getCalendarSlots: (termId: string) =>
    request<CalendarSlot[]>(`/api/terms/${termId}/calendar-slots`),
  importCalendar: (termId: string, data: { slots: Array<{ date: string; dayOfWeek: string; slotType: string; label?: string }> }) =>
    request<ImportResult>(`/api/terms/${termId}/import-calendar`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  importStructure: (termId: string, data: unknown) =>
    request<ImportResult>(`/api/terms/${termId}/import-structure`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // AI
  suggestRedistribution: (canceledSessionId: string, termId: string) =>
    request<Array<{ skillId: string; targetSessionId: string; suggestedLevel: string; rationale: string; confidence: number }>>("/api/ai/suggest-redistribution", {
      method: "POST",
      body: JSON.stringify({ canceledSessionId, termId }),
    }),

  // What-If
  whatIfCompare: (termId: string, sessionA: string, sessionB: string) =>
    request<ScenarioComparison>(
      `/api/terms/${termId}/whatif-compare?sessionA=${sessionA}&sessionB=${sessionB}`,
    ),

  // CSV Import
  importSkillsCsv: (termId: string, csvText: string) =>
    requestRaw<ImportResult>(`/api/terms/${termId}/import-skills-csv`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csvText,
    }),
};
