import type {
  ArtifactExporter,
  ExportResult,
} from "../interfaces/artifact-exporter";

export class MockArtifactExporter implements ArtifactExporter {
  async exportModuleOverview(moduleId: string): Promise<ExportResult> {
    return {
      filename: `module-${moduleId}-overview.md`,
      content: `# Module Overview\n\n[Mock] This would contain the full module overview for module ${moduleId}.\n`,
      mimeType: "text/markdown",
    };
  }

  async exportSessionDescription(sessionId: string): Promise<ExportResult> {
    return {
      filename: `session-${sessionId}.md`,
      content: `# Session Description\n\n[Mock] Session details for ${sessionId}.\n`,
      mimeType: "text/markdown",
    };
  }

  async exportTermSummary(termId: string): Promise<ExportResult> {
    return {
      filename: `term-${termId}-summary.md`,
      content: `# Term Summary\n\n[Mock] Full term summary for ${termId}.\n`,
      mimeType: "text/markdown",
    };
  }

  async generateNotebookSkeleton(assessmentId: string): Promise<ExportResult> {
    const notebook = {
      cells: [
        {
          cell_type: "markdown",
          metadata: {},
          source: [
            `# Assessment ${assessmentId}\n`,
            "\n",
            "[Mock] This notebook skeleton would be generated from the assessment definition.\n",
          ],
        },
        {
          cell_type: "code",
          metadata: {},
          source: ["# Your code here\n"],
          outputs: [],
          execution_count: null,
        },
      ],
      metadata: {
        kernelspec: {
          display_name: "Python 3",
          language: "python",
          name: "python3",
        },
      },
      nbformat: 4,
      nbformat_minor: 5,
    };

    return {
      filename: `assessment-${assessmentId}.ipynb`,
      content: JSON.stringify(notebook, null, 2),
      mimeType: "application/x-ipynb+json",
    };
  }

  async exportSkillsList(termId: string): Promise<ExportResult> {
    return {
      filename: `skills-${termId}.md`,
      content: `# Skills List\n\n[Mock] Skills for term ${termId}.\n`,
      mimeType: "text/markdown",
    };
  }
}
