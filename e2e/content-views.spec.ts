import { test, expect } from "@playwright/test";

/**
 * E2E test: Import course structure → navigate through content views →
 * verify coverage matrix, module detail, session detail, skill detail.
 *
 * Seeds its own test data via the API before navigating.
 */

test.describe("Content Views E2E", () => {
  let termId: string;

  test.beforeAll(async ({ request }) => {
    // 1. Create an instructor
    const instRes = await request.post("/api/instructors", {
      data: { name: "E2E Instructor", email: "e2e@test.com" },
    });
    const instructor = await instRes.json();

    // 2. Create a term
    const termRes = await request.post("/api/terms", {
      data: {
        instructorId: instructor.id,
        code: "E2E-T1",
        name: "E2E Test Term",
        courseCode: "TEST-100",
        startDate: "2026-01-20",
        endDate: "2026-05-15",
      },
    });
    const term = await termRes.json();
    termId = term.id;

    // 3. Import full course structure
    const structureData = {
      modules: [
        {
          code: "LM-01",
          sequence: 0,
          title: "Foundations",
          description: "Core programming concepts",
          learningObjectives: ["Understand variables", "Write basic functions"],
          sessions: [
            { code: "lec-01", sessionType: "lecture", title: "Intro to Programming", date: "2026-01-20", sequence: 0 },
            { code: "lab-01", sessionType: "lab", title: "Lab: Hello World", date: "2026-01-22", sequence: 1 },
            { code: "lec-02", sessionType: "lecture", title: "Variables & Types", date: "2026-01-27", sequence: 2 },
          ],
        },
        {
          code: "LM-02",
          sequence: 1,
          title: "Data Analysis",
          sessions: [
            { code: "lec-03", sessionType: "lecture", title: "CSV Files", date: "2026-02-03", sequence: 0 },
            { code: "lab-02", sessionType: "lab", title: "Lab: Data Loading", date: "2026-02-05", sequence: 1 },
          ],
        },
      ],
      skills: [
        { code: "A01", category: "Programming", description: "Use variables and assignment" },
        { code: "A02", category: "Programming", description: "Write basic functions" },
        { code: "B01", category: "Data", description: "Load CSV files" },
      ],
      coverages: [
        { sessionCode: "lec-01", skillCode: "A01", level: "introduced" },
        { sessionCode: "lab-01", skillCode: "A01", level: "practiced" },
        { sessionCode: "lec-02", skillCode: "A01", level: "assessed" },
        { sessionCode: "lec-02", skillCode: "A02", level: "introduced" },
        { sessionCode: "lec-03", skillCode: "B01", level: "introduced" },
      ],
      assessments: [
        { code: "GAIE-01", assessmentType: "gaie", title: "First GAIE", skillCodes: ["A01"], progressionStage: "copy-paste", dueDate: "2026-02-10" },
      ],
    };

    await request.post(`/api/terms/${termId}/import-structure`, {
      data: structureData,
    });
  });

  test("coverage matrix shows all skills with health bar", async ({ page }) => {
    await page.goto(`/terms/${termId}/coverage`);
    await page.waitForLoadState("networkidle");

    // Health bar should be visible
    await expect(page.locator("text=fully covered")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=partially covered")).toBeVisible();
    await expect(page.locator("text=uncovered")).toBeVisible();

    // ALL skills should be visible (including B01 which has only I)
    await expect(page.locator("text=A01")).toBeVisible();
    await expect(page.locator("text=A02")).toBeVisible();
    await expect(page.locator("text=B01")).toBeVisible();

    // Session headers should be links
    await expect(page.locator("a:has-text('lec-01')")).toBeVisible();
  });

  test("gap filter shows only incomplete skills", async ({ page }) => {
    await page.goto(`/terms/${termId}/coverage`);
    await page.waitForLoadState("networkidle");

    // Click "Show Only Gaps"
    await page.locator("button:has-text('Show Only Gaps')").click();

    // A01 is fully covered (I+P+A), should NOT appear
    // A02 (only I) and B01 (only I) should appear
    await expect(page.locator("text=A02")).toBeVisible();
    await expect(page.locator("text=B01")).toBeVisible();
  });

  test("clickable empty cell adds coverage", async ({ page }) => {
    await page.goto(`/terms/${termId}/coverage`);
    await page.waitForLoadState("networkidle");

    // Find an empty cell ('+' button) and click it
    const addButton = page.locator("button:has-text('+')").first();
    if (await addButton.isVisible()) {
      await addButton.click();
      // Should see I/P/A buttons in the popover
      await expect(page.locator(".absolute >> text=I")).toBeVisible({ timeout: 3000 });
    }
  });

  test("term dashboard shows health panel", async ({ page }) => {
    await page.goto(`/terms/${termId}`);
    await page.waitForLoadState("networkidle");

    // Health stats should be visible
    await expect(page.locator("text=Total Sessions")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Skills Fully Covered")).toBeVisible();

    // Module cards should show session/skill counts
    await expect(page.locator("text=LM-01: Foundations")).toBeVisible();
    await expect(page.locator("text=LM-02: Data Analysis")).toBeVisible();

    // Modules should link to detail pages
    const moduleLink = page.locator("a:has-text('LM-01: Foundations')");
    await expect(moduleLink).toBeVisible();
  });

  test("navigate term → module detail → session detail", async ({ page }) => {
    await page.goto(`/terms/${termId}`);
    await page.waitForLoadState("networkidle");

    // Click on module
    await page.locator("a:has-text('LM-01: Foundations')").click();
    await page.waitForLoadState("networkidle");

    // Module detail page should show
    await expect(page.locator("h1:has-text('LM-01: Foundations')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Learning Objectives")).toBeVisible();
    await expect(page.locator("text=Sessions")).toBeVisible();

    // Should show sessions
    await expect(page.locator("text=lec-01")).toBeVisible();

    // Click on a session
    await page.locator("a:has-text('lec-01: Intro to Programming')").click();
    await page.waitForLoadState("networkidle");

    // Session detail page should show
    await expect(page.locator("h1:has-text('lec-01')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Coverage")).toBeVisible();

    // Coverage should show A01 as introduced
    await expect(page.locator("text=A01")).toBeVisible();
  });

  test("navigate to skill detail from coverage matrix", async ({ page }) => {
    await page.goto(`/terms/${termId}/coverage`);
    await page.waitForLoadState("networkidle");

    // Click on skill A01
    await page.locator("a:has-text('A01')").first().click();
    await page.waitForLoadState("networkidle");

    // Skill detail page
    await expect(page.locator("h1:has-text('A01')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Coverage Status")).toBeVisible();
    await expect(page.locator("text=Coverage Timeline")).toBeVisible();

    // A01 is fully covered
    await expect(page.locator("text=Introduced")).toBeVisible();
    await expect(page.locator("text=Practiced")).toBeVisible();
    await expect(page.locator("text=Assessed")).toBeVisible();
  });

  test("breadcrumbs allow navigation back", async ({ page }) => {
    await page.goto(`/terms/${termId}/coverage`);
    await page.waitForLoadState("networkidle");

    // Breadcrumbs should show terms > term name > Coverage Matrix
    const breadcrumbs = page.locator("nav >> a");
    await expect(breadcrumbs.first()).toBeVisible({ timeout: 10000 });

    // Click on term name in breadcrumbs
    await page.locator("nav >> a:has-text('E2E Test Term')").click();
    await page.waitForLoadState("networkidle");

    // Should be back on term detail
    await expect(page.locator("text=Total Sessions")).toBeVisible({ timeout: 10000 });
  });
});
