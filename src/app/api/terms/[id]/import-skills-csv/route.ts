import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api-helpers";

interface CsvRow {
  code: string;
  category: string;
  description: string;
  moduleCode?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const codeIdx = headers.indexOf("code");
  const categoryIdx = headers.indexOf("category");
  const descriptionIdx = headers.indexOf("description");
  const moduleCodeIdx = headers.indexOf("module_code");

  if (codeIdx === -1 || categoryIdx === -1 || descriptionIdx === -1) {
    throw new Error(
      "CSV must have columns: code, category, description (and optional module_code)",
    );
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles quoted fields)
    const cells = parseCsvLine(line);
    const code = cells[codeIdx]?.trim();
    const category = cells[categoryIdx]?.trim();
    const description = cells[descriptionIdx]?.trim();
    const moduleCode = moduleCodeIdx >= 0 ? cells[moduleCodeIdx]?.trim() : undefined;

    if (!code || !category || !description) {
      throw new Error(`Row ${i + 1}: missing required fields (code, category, description)`);
    }

    rows.push({ code, category, description, moduleCode });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: termId } = await params;

  try {
    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term) return notFound("Term not found");

    const text = await request.text();
    if (!text.trim()) return badRequest("Empty CSV body");

    let rows: CsvRow[];
    try {
      rows = parseCsv(text);
    } catch (e) {
      return badRequest((e as Error).message);
    }

    if (rows.length === 0) return badRequest("No data rows found in CSV");

    // Check for duplicate codes in input
    const codes = rows.map((r) => r.code);
    const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (duplicates.length > 0) {
      return badRequest(`Duplicate codes in CSV: ${[...new Set(duplicates)].join(", ")}`);
    }

    // Check for conflicts with existing skills
    const existing = await prisma.skill.findMany({
      where: { termId, code: { in: codes } },
      select: { code: true },
    });
    if (existing.length > 0) {
      return badRequest(
        `Skill codes already exist: ${existing.map((s) => s.code).join(", ")}`,
      );
    }

    // Create all skills
    let created = 0;
    for (const row of rows) {
      await prisma.skill.create({
        data: {
          code: row.code,
          category: row.category,
          description: row.description,
          isGlobal: false,
          termId,
        },
      });
      created++;
    }

    return ok({ created, total: rows.length });
  } catch (error) {
    console.error("CSV import error:", error);
    return serverError("Failed to import skills from CSV");
  }
}
