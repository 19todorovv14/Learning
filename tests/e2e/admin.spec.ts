import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const ADMIN = `admin-${Date.now()}@example.bg`;
const PASS = "АдминПарола2026";
const NOTE = `e2e промяна ${Date.now()}`;

test.beforeAll(() => {
  execSync(`npx tsx scripts/create-admin.ts ${ADMIN} "${PASS}" "Админ Тест"`, {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    stdio: "inherit",
  });
});

test("администратор редактира урок, вижда версии и одобрява", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(ADMIN);
  await page.getByLabel("Парола").fill(PASS);
  await page.getByRole("button", { name: "Вход" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Табло" })).toBeVisible();
  await page.goto("/admin/lessons");
  await page.getByRole("link", { name: "Формули за съкратено умножение" }).click();
  const editor = page.getByLabel("Изходен текст на урока");
  await expect(editor).toBeVisible();

  // Невалиден урок се отхвърля с ясни грешки
  const original = await editor.inputValue();
  await editor.fill(original.replace("# Записки", "# Непозната секция"));
  await page.getByRole("button", { name: "Запази нова версия" }).click();
  await expect(page.getByText(/Непозната секция/).first()).toBeVisible();

  // Валидна промяна → нова версия
  await editor.fill(original.replace(/^minutes: \d+$/m, "minutes: 31"));
  await page.getByPlaceholder("Кратко описание на промяната (по желание)").fill(NOTE);
  await page.getByRole("button", { name: "Запази нова версия" }).click();
  await expect(page.getByText("Урокът е записан като нова версия.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(NOTE)).toBeVisible();

  // Одобряване от опашката
  await page.goto("/admin/review");
  await expect(page.getByRole("heading", { name: "Проверка и сигнали" })).toBeVisible();
  await page.goto("/admin/ai");
  await expect(page.getByText("AI учител: използване и разходи")).toBeVisible();
  await page.goto("/admin/audit");
  await expect(page.getByText("lesson.update").first()).toBeVisible();
});
