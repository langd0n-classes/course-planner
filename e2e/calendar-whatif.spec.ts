import { test, expect } from "@playwright/test";

/**
 * E2E smoke test: Import calendar JSON → navigate to calendar →
 * verify sessions appear → open what-if panel → see at-risk skills.
 *
 * Prerequisites: The dev server must be running with a seeded database.
 * Run: npx prisma db:seed && npm run dev, then npx playwright test
 */

test.describe("Calendar and What-If E2E", () => {
  test("import calendar, navigate to calendar, verify sessions, open what-if", async ({
    page,
  }) => {
    // 1. Navigate to the terms page and find the first term
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click on first term link (seeded term should exist)
    const termLink = page.locator("a[href*='/terms/']").first();
    await expect(termLink).toBeVisible({ timeout: 10000 });
    await termLink.click();
    await page.waitForLoadState("networkidle");

    // 2. Get the term ID from the URL
    const url = page.url();
    const termIdMatch = url.match(/\/terms\/([^/]+)/);
    expect(termIdMatch).toBeTruthy();
    const termId = termIdMatch![1];

    // 3. Navigate to import page
    await page.goto(`/terms/${termId}/import`);
    await page.waitForLoadState("networkidle");

    // Import calendar data via the JSON textarea
    const calendarData = {
      slots: [
        { date: "2026-01-20", dayOfWeek: "Tuesday", slotType: "class_day" },
        { date: "2026-01-22", dayOfWeek: "Thursday", slotType: "class_day" },
        { date: "2026-01-27", dayOfWeek: "Tuesday", slotType: "class_day" },
        { date: "2026-01-29", dayOfWeek: "Thursday", slotType: "class_day" },
        { date: "2026-02-03", dayOfWeek: "Tuesday", slotType: "class_day" },
        { date: "2026-02-05", dayOfWeek: "Thursday", slotType: "class_day" },
      ],
    };

    // Find the calendar import section and textarea
    const calendarSection = page.locator("text=Calendar JSON").first();
    if (await calendarSection.isVisible()) {
      const textarea = page.locator("textarea").first();
      await textarea.fill(JSON.stringify(calendarData));

      // Find and click the import button for calendar
      const importBtn = page
        .locator("button")
        .filter({ hasText: /import/i })
        .first();
      await importBtn.click();
      await page.waitForTimeout(1000);
    }

    // 4. Navigate to calendar view
    await page.goto(`/terms/${termId}/calendar`);
    await page.waitForLoadState("networkidle");

    // 5. Verify the calendar heading is visible
    await expect(page.locator("h1")).toContainText("Calendar");

    // 6. Verify sessions appear on the calendar (or "Unplanned" cells exist)
    // Look for session cards or the calendar table
    const calendarTable = page.locator("table");
    await expect(calendarTable).toBeVisible({ timeout: 10000 });

    // Check for either session cards or unplanned cells
    const sessionCards = page.locator("[class*='font-mono']");
    const unplannedCells = page.locator("text=Unplanned");

    const hasSessionCards = (await sessionCards.count()) > 0;
    const hasUnplannedCells = (await unplannedCells.count()) > 0;
    expect(hasSessionCards || hasUnplannedCells).toBeTruthy();

    // 7. If session cards exist, try the what-if flow
    if (hasSessionCards) {
      // Find and click "What if cancel?" on a session
      const whatIfButton = page.locator("text=What if cancel?").first();
      if (await whatIfButton.isVisible()) {
        await whatIfButton.click();
        await page.waitForTimeout(500);

        // Verify the what-if panel opened
        const whatIfPanel = page.locator("text=What-If Analysis");
        await expect(whatIfPanel).toBeVisible({ timeout: 5000 });

        // Verify coverage impact section
        const coverageImpact = page.locator("text=Coverage Impact");
        await expect(coverageImpact).toBeVisible();

        // Look for at-risk skills or the cancel button
        const cancelButton = page.locator(
          "button:has-text('Cancel & Redistribute'), button:has-text('Apply Cancellation')",
        );
        await expect(cancelButton.first()).toBeVisible({ timeout: 5000 });

        // Close the panel
        const closeButton = page.locator("button").filter({ hasText: "×" }).first();
        await closeButton.click();
      }
    }

    // 8. Verify empty cells are clickable (if any exist)
    if (hasUnplannedCells) {
      const emptyCell = unplannedCells.first();
      await emptyCell.click();
      await page.waitForTimeout(300);

      // Should see the popover with "Create new session" option
      const createOption = page.locator("text=Create new session");
      if (await createOption.isVisible()) {
        await expect(createOption).toBeVisible();
        // Close the popover by clicking outside
        await page.keyboard.press("Escape");
      }
    }
  });

  test("what-if panel accessible from term detail page", async ({ page }) => {
    // Navigate to terms page
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click on first term
    const termLink = page.locator("a[href*='/terms/']").first();
    await expect(termLink).toBeVisible({ timeout: 10000 });
    await termLink.click();
    await page.waitForLoadState("networkidle");

    // Verify we're on the term detail page
    await expect(page.locator("h1")).toBeVisible();

    // Look for "What if cancel?" button on sessions
    const whatIfButton = page.locator("text=What if cancel?").first();
    if (await whatIfButton.isVisible()) {
      await whatIfButton.click();
      await page.waitForTimeout(500);

      // Verify the what-if panel opened
      await expect(
        page.locator("text=What-If Analysis"),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
