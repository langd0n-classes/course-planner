import { expect, test, type Page } from "@playwright/test";

async function openAuthenticatedPrototype(page: Page) {
  await page.goto("/prototypes/activity-workspace");

  const previewSignIn = page.getByRole("button", {
    name: /sign in with development preview/i,
  });
  if (await previewSignIn.isVisible()) {
    await previewSignIn.click();
  }

  await expect(page).toHaveURL(/\/prototypes\/activity-workspace$/);
  await expect(page.getByRole("heading", { name: "Data Science 100" })).toBeVisible();
  // The authenticated route is server-rendered before the client workspace hydrates.
  await page.waitForTimeout(300);
}

test.describe("B.2R activity workspace", () => {
  test("supports dense Course design tasks and exact-time project milestones", async ({ page }, testInfo) => {
    await openAuthenticatedPrototype(page);

    await expect(page.getByLabel("Topic bank")).toBeVisible();
    expect(await page.getByRole("article").count()).toBeGreaterThan(40);

    const lm01Column = page.getByRole("region", { name: "Activity column LM01: Data Wrangling" });
    const unassignedColumn = page.getByRole("region", { name: "Activity column Unassigned / Cross-cutting" });
    const projectCard = unassignedColumn.getByRole("article", { name: /predictive model/i });
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await projectCard.dispatchEvent("dragstart", { dataTransfer });
    await lm01Column.dispatchEvent("dragover", { dataTransfer });
    await lm01Column.dispatchEvent("drop", { dataTransfer });
    await expect(lm01Column.getByRole("article", { name: /predictive model/i })).toBeVisible();
    await lm01Column.getByRole("button", { name: /move project 1: predictive model/i }).click();
    await page.getByRole("dialog", { name: "Move activity to module" })
      .getByRole("button", { name: "Unassigned / Cross-cutting" })
      .click();
    await expect(unassignedColumn.getByRole("article", { name: /predictive model/i })).toBeVisible();

    await page.getByRole("button", { name: /^Topics$/ }).click();
    const topicsDialog = page.getByRole("dialog", { name: "Topics" });
    await expect(topicsDialog.getByText(/150 topics/i)).toBeVisible();

    const title = topicsDialog.getByLabel("New topic title");
    await title.fill("Causal diagrams");
    await expect(topicsDialog.getByLabel("New topic code")).toHaveValue("CD");
    await title.press("Tab");
    await expect(topicsDialog.getByLabel("New topic code")).toBeFocused();
    await topicsDialog.getByLabel("New topic category").fill("Inference & Ethics");
    await topicsDialog.getByRole("button", { name: "Create topic" }).click();
    await expect(topicsDialog.getByRole("group", { name: "Topic Causal diagrams" })).toBeVisible();
    await topicsDialog.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: /^Activity types$/ }).click();
    const typesDialog = page.getByRole("dialog", { name: "Activity types" });
    await typesDialog.getByRole("textbox", { name: "Instructor label", exact: true }).fill("Recitation");
    await typesDialog.getByRole("combobox", { name: "Stable family" }).selectOption("Meeting");
    await typesDialog.getByRole("button", { name: "Add type" }).click();
    await expect(typesDialog.locator('input[value="Recitation"]')).toBeVisible();
    await typesDialog.getByRole("button", { name: "Close" }).click();

    const project = page.getByRole("article", { name: /predictive model/i });
    await project.getByRole("button", { name: /predictive model/i }).first().click();
    await page.getByLabel("Milestone label").fill("Instructor review packet");
    await page.getByLabel("Use exact date").click();
    await page.getByLabel("Date", { exact: true }).fill("2026-04-16");
    await page.getByLabel("Time", { exact: true }).fill("09:15");
    await page.getByRole("button", { name: "Add milestone" }).click();
    await expect(page.getByText("Exact date Apr 16, 2026 · 09:15")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("design-desktop.png") });

    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByLabel("Current status")).toBeVisible();
    await expect(page.getByLabel("Upcoming work")).toContainText("Next milestone");
    await expect(page.getByLabel("Calendar signals")).toContainText(/finals/i);
    await page.screenshot({ path: testInfo.outputPath("run-desktop.png") });
  });

  test("shows inherited calendar periods and adds a Term-only exception", async ({ page }) => {
    await openAuthenticatedPrototype(page);

    await page.getByRole("button", { name: /^Calendar$/ }).click();
    const calendarDialog = page.getByRole("dialog", { name: "Calendar" });
    await expect(calendarDialog.getByText(/institution calendar inheritance/i)).toBeVisible();
    await expect(calendarDialog.getByText(/finals period/i).first()).toBeVisible();

    const form = calendarDialog.getByRole("form", {
      name: /add term-only exception for spring 2026/i,
    });
    await form.getByLabel("Exception date").fill("2026-04-22");
    await form.getByLabel("Exception kind").selectOption("moved");
    await form.getByLabel("Reason").fill("Department symposium schedule");
    await form.getByRole("button", { name: "Add term-only exception" }).click();

    await expect(calendarDialog.getByText("Department symposium schedule")).toBeVisible();
    await expect(calendarDialog.getByText("Applies to Spring 2026 only").last()).toBeVisible();
  });

  test("keeps the primary Run information visible at a narrow viewport", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 430, height: 900 });
    await openAuthenticatedPrototype(page);
    await page.getByRole("button", { name: "Run" }).click();

    await expect(page.getByText("Current module", { exact: true })).toBeVisible();
    await expect(page.getByText("Next meeting", { exact: true })).toBeVisible();
    await expect(page.getByText("Next milestone", { exact: true })).toBeVisible();
    await expect(page.getByText("Prepare for next meeting", { exact: true })).toBeVisible();
    const { horizontalOverflow, scrollX, currentStatusLeft } = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      scrollX: window.scrollX,
      currentStatusLeft: document.querySelector('[aria-label="Current status"]')?.getBoundingClientRect().left ?? -1,
    }));
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    expect(scrollX).toBeLessThanOrEqual(1);
    expect(currentStatusLeft).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("run-narrow.png"), fullPage: true });
  });
});
