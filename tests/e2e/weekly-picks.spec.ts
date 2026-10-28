import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("a league member can submit and revise ten picks before lockout", async ({
  page,
}) => {
  test.skip(
    !email || !password,
    "Set E2E_EMAIL and E2E_PASSWORD for local Supabase.",
  );

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/leagues");

  const leagueName = `E2E League ${Date.now()}`;
  await page.getByLabel("League name").fill(leagueName);
  await page.getByRole("button", { name: "Create private league" }).click();
  await expect(page.getByText(leagueName)).toBeVisible();
  await page.getByRole("link", { name: "Open league" }).last().click();

  const scheduleUnavailable = page.getByRole("heading", {
    name: "Schedule unavailable",
  });
  if (await scheduleUnavailable.isVisible()) {
    test.skip(
      true,
      "A current regular-season schedule is required for this flow.",
    );
  }

  const deadlineValue = await page
    .locator("time[datetime]")
    .getAttribute("datetime");
  if (!deadlineValue || Date.now() >= Date.parse(deadlineValue)) {
    test.skip(true, "The current week's deadline has passed.");
  }

  const matchups = page.locator(".matchup");
  const matchupCount = await matchups.count();
  if (matchupCount < 10) {
    test.skip(true, "The loaded schedule has fewer than ten games.");
  }

  for (let index = 0; index < 10; index += 1) {
    await matchups.nth(index).getByRole("button").first().click();
  }
  await expect(page.getByText("10 / 10 selected")).toBeVisible();
  await page.getByRole("button", { name: "Submit picks" }).click();
  await expect(page.getByText("Your picks have been saved.")).toBeVisible();

  await matchups.nth(0).getByRole("button").nth(1).click();
  await page.getByRole("button", { name: "Update picks" }).click();
  await expect(page.getByText("Your picks have been saved.")).toBeVisible();
  await expect(page.getByText("10 / 10 selected")).toBeVisible();
});
