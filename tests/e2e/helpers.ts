import { expect, type Page } from "@playwright/test";
import { query } from "./db";

export const PASSWORD = "ТестоваПарола2026";

export async function register(page: Page, opts: { name?: string; email?: string } = {}) {
  const email = opts.email ?? `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.bg`;
  // Всички e2e регистрации идват от един IP — нулираме лимита за регистрации (8 на час), за да не се блокират тестовете
  await query(`delete from "RateLimitBucket" where key like 'register:%'`);
  await page.goto("/register");
  await page.getByLabel("Име (както искаш да те наричаме)").fill(opts.name ?? "Мария");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(PASSWORD);
  await page.getByText("14–17 г.").click();
  await page.locator('input[name="acceptTerms"]').check();
  await page.getByRole("button", { name: "Създай профил" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  return email;
}

export async function completeOnboarding(page: Page, grade = 7) {
  await page.getByRole("button", { name: /Ученик \(1\.–12\. клас\)/ }).click();
  await page.getByRole("button", { name: "Напред" }).click();
  await page.getByLabel("Населено място").fill("Пловдив");
  await page.getByLabel("Клас").selectOption(String(grade));
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("heading", { name: "Какво изучаваш?" })).toBeVisible();
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("heading", { name: /Готово/ })).toBeVisible();
  await page.getByRole("button", { name: "Към моето обучение" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
