import { describe, it, expect } from "vitest";
import { MockArtifactExporter } from "./mock-artifact-exporter";

describe("MockArtifactExporter", () => {
  const exporter = new MockArtifactExporter();

  it("exports module overview", async () => {
    const result = await exporter.exportModuleOverview("mod-123");
    expect(result.filename).toContain("mod-123");
    expect(result.mimeType).toBe("text/markdown");
    expect(result.content).toContain("Module Overview");
  });

  it("exports session description", async () => {
    const result = await exporter.exportSessionDescription("sess-456");
    expect(result.filename).toContain("sess-456");
    expect(result.mimeType).toBe("text/markdown");
  });

  it("exports term summary", async () => {
    const result = await exporter.exportTermSummary("term-789");
    expect(result.filename).toContain("term-789");
    expect(result.mimeType).toBe("text/markdown");
  });

  it("generates notebook skeleton", async () => {
    const result = await exporter.generateNotebookSkeleton("assess-001");
    expect(result.filename).toContain("assess-001");
    expect(result.mimeType).toBe("application/x-ipynb+json");
    const notebook = JSON.parse(result.content as string);
    expect(notebook.nbformat).toBe(4);
    expect(notebook.cells).toHaveLength(2);
    expect(notebook.cells[0].cell_type).toBe("markdown");
    expect(notebook.cells[1].cell_type).toBe("code");
  });

  it("exports skills list", async () => {
    const result = await exporter.exportSkillsList("term-789");
    expect(result.filename).toContain("skills");
    expect(result.mimeType).toBe("text/markdown");
  });
});
