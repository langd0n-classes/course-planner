/**
 * Artifact exporter interface.
 * Handles generation of teaching artifacts (notebooks, handouts, etc.)
 */

export interface ExportResult {
  filename: string;
  content: Buffer | string;
  mimeType: string;
}

export interface ArtifactExporter {
  /**
   * Export a module overview as markdown.
   */
  exportModuleOverview(moduleId: string): Promise<ExportResult>;

  /**
   * Export a session description.
   */
  exportSessionDescription(sessionId: string): Promise<ExportResult>;

  /**
   * Export a term summary.
   */
  exportTermSummary(termId: string): Promise<ExportResult>;

  /**
   * Generate a notebook skeleton for an assessment (Otter-Grader style).
   */
  generateNotebookSkeleton(assessmentId: string): Promise<ExportResult>;

  /**
   * Export a skills list by category.
   */
  exportSkillsList(termId: string): Promise<ExportResult>;
}
