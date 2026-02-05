import { NextRequest, NextResponse } from "next/server";
import { notFound } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import { getArtifactExporter } from "@/services";

/**
 * GET /api/artifacts/export/[id]
 *
 * Generate/export an artifact by its ID.
 * Uses the ArtifactExporter service interface.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const artifact = await prisma.artifact.findUnique({ where: { id } });
  if (!artifact) return notFound("Artifact not found");

  const exporter = getArtifactExporter();
  let result;

  switch (artifact.parentType) {
    case "session":
      if (!artifact.sessionId) return notFound("No session linked");
      result = await exporter.exportSessionDescription(artifact.sessionId);
      break;
    case "assessment":
      if (!artifact.assessmentId) return notFound("No assessment linked");
      if (artifact.artifactType === "notebook") {
        result = await exporter.generateNotebookSkeleton(
          artifact.assessmentId,
        );
      } else {
        result = await exporter.exportSessionDescription(
          artifact.assessmentId,
        );
      }
      break;
    case "module":
      result = await exporter.exportModuleOverview(artifact.moduleId ?? id);
      break;
    default:
      return notFound("Unknown parent type");
  }

  // Update generated_at timestamp
  await prisma.artifact.update({
    where: { id },
    data: { generatedAt: new Date() },
  });

  const body =
    typeof result.content === "string"
      ? result.content
      : new Uint8Array(result.content);

  return new NextResponse(body, {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
