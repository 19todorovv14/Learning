import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { completeOnboarding, PASSWORD, register } from "./helpers";
import { query } from "./db";

test.describe.configure({ mode: "serial" });

test("изходът обезсилва сесията; старата бисквитка не дава достъп", async ({ page, browser }) => {
  await register(page);
  await completeOnboarding(page);
  const cookies = (await page.context().cookies()).filter((c) => c.name === "bgl_session");
  expect(cookies[0]?.httpOnly).toBe(true);
  expect(cookies[0]?.sameSite).toBe("Lax");
  await page.getByRole("button", { name: "Профил" }).click();
  await page.getByRole("menuitem", { name: "Изход" }).click();
  await expect(page).toHaveURL(/\/$/);
  const stale = await browser.newContext();
  await stale.addCookies(cookies);
  const p = await stale.newPage();
  await p.goto("/dashboard");
  await expect(p).toHaveURL(/\/login/);
  await stale.close();
});

test("ученик не може да изпълни админ действие чрез повторена истинска заявка", async ({ page, browser }) => {
  // ученик
  const studentEmail = await register(page, { name: "Жертва" });
  await completeOnboarding(page);
  const student = (await query<{ id: string }>(`select id from "User" where email=$1`, [studentEmail]))[0];

  // администратор сменя роля — прихващаме заявката
  const admin = `sec-admin-${Date.now()}@example.bg`;
  execSync(`npx tsx scripts/create-admin.ts ${admin} "${PASSWORD}" "Админ"`, {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    stdio: "pipe",
  });
  const actx = await browser.newContext();
  const ap = await actx.newPage();
  await ap.goto("/login");
  await ap.getByLabel("Имейл").fill(admin);
  await ap.getByLabel("Парола").fill(PASSWORD);
  await ap.getByRole("button", { name: "Вход" }).click();
  await expect(ap).toHaveURL(/\/(dashboard|onboarding)/);
  await ap.goto("/admin/users");
  const req = ap.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  const row = ap.getByRole("row").filter({ hasText: studentEmail });
  await row.getByRole("combobox").selectOption("TEACHER");
  await row.getByRole("button", { name: "Запази" }).click();
  const captured = await req;
  await expect.poll(async () => (await query<{ role: string }>(`select role from "User" where id=$1`, [student.id]))[0].role).toBe("TEACHER");
  await query(`update "User" set role='STUDENT' where id=$1`, [student.id]);

  // ученикът изпраща същата заявка от своя браузър (със своята сесия), но иска ADMIN за себе си
  const headers = Object.fromEntries(
    Object.entries(captured.headers()).filter(([k]) => !["cookie", "content-length", "host", "origin", "referer", "connection"].includes(k) && !k.startsWith("sec-")),
  );
  const body = captured.postDataBuffer()!.toString("utf8").replace(/TEACHER/g, "ADMIN");
  // смяната на роля обезсилва сесиите на потребителя — ученикът влиза отново
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(studentEmail);
  await page.getByLabel("Парола").fill(PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const result = await page.evaluate(
    async ({ url, headers, body }) => {
      const r = await fetch(url, { method: "POST", headers, body, redirect: "manual" });
      return { status: r.status, redirect: r.headers.get("x-action-redirect") };
    },
    { url: captured.url(), headers, body },
  );
  expect(result.status).toBeLessThan(500);
  expect(result.redirect).toContain("forbidden=1");
  expect((await query<{ role: string }>(`select role from "User" where id=$1`, [student.id]))[0].role).toBe("STUDENT");
  const forbidden = await query(`select 1 from "AuditLog" where "actorId"=$1 and action='auth.forbidden'`, [student.id]);
  expect(forbidden.length).toBeGreaterThan(0);
  await actx.close();
});

test("смяна на забравена парола: старите сесии отпадат, линкът е еднократен", async ({ page, browser }) => {
  const email = await register(page);
  await completeOnboarding(page);
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto("/forgot-password");
  await p2.getByLabel("Имейл").fill(email);
  await p2.getByRole("button", { name: "Изпрати линк" }).click();
  await expect.poll(async () => (await query(`select 1 from "DevEmail" where "to"=$1 and text like '%reset-password%'`, [email])).length).toBe(1);
  const text = (await query<{ text: string }>(`select text from "DevEmail" where "to"=$1 and text like '%reset-password%'`, [email]))[0].text;
  const link = text.match(/https?:\/\/\S+reset-password\?token=\S+/)![0].replace(/^https?:\/\/[^/]+/, "");
  await p2.goto(link);
  await p2.getByLabel("Нова парола").fill("СъвсемНоваПарола9");
  await p2.getByLabel("Повтори паролата").fill("СъвсемНоваПарола9");
  await p2.getByRole("button", { name: "Запази новата парола" }).click();
  await expect.poll(async () => {
    await page.goto("/dashboard");
    return page.url();
  }).toMatch(/\/login/);
  await p2.goto(link);
  await expect(p2.getByText("Линкът е невалиден или е изтекъл")).toBeVisible();
  await other.close();
});

test("тестовата пощенска кутия показва само собствените писма", async ({ page, browser }) => {
  const a = await register(page, { name: "Първи" });
  await completeOnboarding(page);
  const bctx = await browser.newContext();
  const bp = await bctx.newPage();
  const b = await register(bp, { name: "Втори" });
  await page.goto("/dev/mailbox");
  await expect(page.getByTestId("dev-email-to").filter({ hasText: a }).first()).toBeVisible();
  await expect(page.getByTestId("dev-email-to").filter({ hasText: b })).toHaveCount(0);
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  const res = await ap.goto("/dev/mailbox");
  expect(res?.status()).toBe(404);
  await bctx.close();
  await anon.close();
});
