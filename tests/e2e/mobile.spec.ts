import { expect, test } from "@playwright/test";

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
