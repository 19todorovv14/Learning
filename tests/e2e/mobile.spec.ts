import { expect, test } from "@playwright/test";
import { completeOnboarding, register } from "./helpers";

test("мобилна навигация и урок на телефон", async ({ page }) => {
  await page.goto("/subjects");
  const bottom = page.getByRole("navigation", { name: "Бърза навигация" });
  await expect(bottom).toBeVisible();
  await bottom.getByRole("button", { name: "Още" }).click();
  const drawer = page.getByRole("dialog", { name: "Меню" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Шофьорски изпити" }).click();
  await expect(page).toHaveURL(/\/driving/);
  await expect(drawer).toBeHidden();

  await page.goto("/lessons/matematika-7-formuli-za-sakrateno-umnozhenie");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // без хоризонтално превъртане
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("без хоризонтално превъртане на страниците на ученика (телефон)", async ({ page }) => {
  await register(page);
  await completeOnboarding(page, 7);
  const wide: string[] = [];
  for (const p of ["/dashboard", "/my-learning", "/progress", "/quizzes", "/review", "/notes", "/plan", "/settings", "/tutor", "/subjects", "/grades/7", "/driving", "/universities"]) {
    await page.goto(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) wide.push(`${p}: ${overflow}px`);
  }
  expect(wide).toEqual([]);
});
