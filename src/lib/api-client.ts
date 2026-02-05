/** Simple fetch wrapper for client components */

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

export const api = {
  // Instructors
  getInstructors: () => request<unknown[]>("/api/instructors"),

  // Terms
  getTerms: (instructorId?: string) =>
    request<unknown[]>(
      `/api/terms${instructorId ? `?instructorId=${instructorId}` : ""}`,
    ),
  getTerm: (id: string) => request<unknown>(`/api/terms/${id}`),
  createTerm: (data: unknown) =>
    request<unknown>("/api/terms", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTerm: (id: string, data: unknown) =>
    request<unknown>(`/api/terms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTerm: (id: string) =>
    request<unknown>(`/api/terms/${id}`, { method: "DELETE" }),
  cloneTerm: (id: string, data: unknown) =>
    request<unknown>(`/api/terms/${id}/clone`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTermImpact: (id: string) =>
    request<unknown>(`/api/terms/${id}/impact`),

  // Modules
  getModules: (termId?: string) =>
    request<unknown[]>(
      `/api/modules${termId ? `?termId=${termId}` : ""}`,
    ),
  createModule: (data: unknown) =>
    request<unknown>("/api/modules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateModule: (id: string, data: unknown) =>
    request<unknown>(`/api/modules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteModule: (id: string) =>
    request<unknown>(`/api/modules/${id}`, { method: "DELETE" }),

  // Skills
  getSkills: (termId?: string) =>
    request<unknown[]>(
      `/api/skills${termId ? `?termId=${termId}` : ""}`,
    ),
  createSkill: (data: unknown) =>
    request<unknown>("/api/skills", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSkill: (id: string, data: unknown) =>
    request<unknown>(`/api/skills/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSkill: (id: string) =>
    request<unknown>(`/api/skills/${id}`, { method: "DELETE" }),

  // Sessions
  getSessions: (params?: { moduleId?: string; termId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.moduleId) qs.set("moduleId", params.moduleId);
    if (params?.termId) qs.set("termId", params.termId);
    const q = qs.toString();
    return request<unknown[]>(`/api/sessions${q ? `?${q}` : ""}`);
  },
  createSession: (data: unknown) =>
    request<unknown>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSession: (id: string, data: unknown) =>
    request<unknown>(`/api/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSession: (id: string) =>
    request<unknown>(`/api/sessions/${id}`, { method: "DELETE" }),
  moveSession: (id: string, data: unknown) =>
    request<unknown>(`/api/sessions/${id}/move`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

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
    return request<unknown[]>(`/api/coverages${q ? `?${q}` : ""}`);
  },
  createCoverage: (data: unknown) =>
    request<unknown>("/api/coverages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCoverage: (id: string) =>
    request<unknown>(`/api/coverages/${id}`, { method: "DELETE" }),

  // Assessments
  getAssessments: (termId?: string) =>
    request<unknown[]>(
      `/api/assessments${termId ? `?termId=${termId}` : ""}`,
    ),
  createAssessment: (data: unknown) =>
    request<unknown>("/api/assessments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAssessment: (id: string, data: unknown) =>
    request<unknown>(`/api/assessments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteAssessment: (id: string) =>
    request<unknown>(`/api/assessments/${id}`, { method: "DELETE" }),

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
};
