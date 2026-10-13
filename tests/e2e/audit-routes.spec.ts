import { execSync } from "node:child_process";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { completeOnboarding, register } from "./helpers";
import { query } from "./db";

/**
 * Обхожда всички страници за анонимен потребител, ученик и администратор.
 * Проверява: няма 5xx, няма грешки в конзолата и на страницата, защитените страници
 * пренасочват правилно и всички вътрешни линкове от страниците работят.
 */
test.describe.configure({ mode: "serial", timeout: 600_000 });

const ADMIN = `audit-admin-${Date.now()}@example.bg`;
const PASS = "ОдитПарола2026";

async function dynamicRoutes() {
  const one = async (sql: string) => Object.values((await query(sql))[0] ?? {})[0] as string;
  return {
    lesson: await one(`select slug from "Lesson" where status <> 'DRAFT' order by slug limit 1`),
    course: await one(`select slug from "CurriculumVersion" order by slug limit 1`),
    subject: await one(`select slug from "Subject" order by "order" limit 1`),
    university: await one(`select slug from "University" order by name limit 1`),
    vocational: await one(`select code from "VocationalProfession" order by code limit 1`),
    adminLesson: await one(`select id from "Lesson" order by slug limit 1`),
  };
}

type Problem = string;

async function visit(page: Page, url: string, problems: Problem[], links: Set<string>) {
  const errors: string[] = [];
  const onPageError = (e: Error) => errors.push(`pageerror: ${e.message.slice(0, 160)}`);
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`);
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  const res = await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(300);
  page.off("pageerror", onPageError);
  page.off("console", onConsole);
  const status = res?.status() ?? 0;
  if (status >= 500) problems.push(`${url}: HTTP ${status}`);
  for (const e of errors) problems.push(`${url}: ${e}`);
  for (const h of await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")!))) {
    if (!h.startsWith("//") && !h.startsWith("/api/")) links.add(h.split("#")[0]);
  }
  return page.url();
}

async function checkLinks(ctx: BrowserContext, links: Set<string>, problems: Problem[]) {
  for (const l of links) {
    const r = await ctx.request.get(l, { maxRedirects: 0 });
    if (r.status() >= 400) problems.push(`линк ${l}: HTTP ${r.status()}`);
  }
}

const PUBLIC = ["/", "/about-content", "/privacy", "/terms", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/subjects", "/lessons", "/admission", "/universities", "/vocational", "/driving", "/first-aid", "/search?q=питагорова"];
const USER = ["/dashboard", "/my-learning", "/progress", "/quizzes", "/review", "/notes", "/plan", "/notifications", "/settings", "/tutor", "/tutor/history", "/onboarding"];
const ADMIN_PAGES = ["/admin", "/admin/ai", "/admin/audit", "/admin/errors", "/admin/import", "/admin/lessons", "/admin/lessons/new", "/admin/pipeline", "/admin/review", "/admin/schools", "/admin/sources", "/admin/users"];

test("анонимен потребител: публичните страници работят, защитените пренасочват към вход", async ({ page, context }) => {
  const d = await dynamicRoutes();
  const routes = [...PUBLIC, `/lessons/${d.lesson}`, `/lessons/${d.lesson}?mode=learn`, `/lessons/${d.lesson}?mode=practice`, `/courses/${d.course}`, `/subjects/${d.subject}`, "/grades/7", `/universities/${d.university}`, `/vocational/${d.vocational}`];
  const problems: Problem[] = [];
  const links = new Set<string>();
  for (const r of routes) await visit(page, r, problems, links);
  for (const r of [...USER, ...ADMIN_PAGES]) {
    const final = await visit(page, r, problems, links);
    if (!final.includes("/login")) problems.push(`${r}: не пренасочва към вход (${final})`);
  }
  await checkLinks(context, links, problems);
  expect(problems).toEqual([]);
});

test("ученик: всички страници на профила работят, администрацията е забранена", async ({ page, context }) => {
  await register(page);
  await completeOnboarding(page, 7);
  const problems: Problem[] = [];
  const links = new Set<string>();
  for (const r of USER) await visit(page, r, problems, links);
  for (const r of ADMIN_PAGES) {
    const final = await visit(page, r, problems, links);
    if (!final.includes("forbidden=1")) problems.push(`${r}: ученик не е спрян (${final})`);
  }
  await checkLinks(context, links, problems);
  expect(problems).toEqual([]);
});

test("администратор: всички страници на администрацията работят", async ({ page, context }) => {
  execSync(`npx tsx scripts/create-admin.ts ${ADMIN} "${PASS}" "Одит Админ"`, {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    stdio: "pipe",
  });
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(ADMIN);
  await page.getByLabel("Парола").fill(PASS);
  await page.getByRole("button", { name: "Вход" }).click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  const d = await dynamicRoutes();
  const problems: Problem[] = [];
  const links = new Set<string>();
  for (const r of [...ADMIN_PAGES, `/admin/lessons/${d.adminLesson}`]) {
    const final = await visit(page, r, problems, links);
    if (!final.includes("/admin")) problems.push(`${r}: пренасочен (${final})`);
  }
  await checkLinks(context, links, problems);
  expect(problems).toEqual([]);
});
