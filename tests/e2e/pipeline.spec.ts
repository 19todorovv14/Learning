import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { completeOnboarding, register } from "./helpers";
import { query } from "./db";

/**
 * Pipeline за съдържание през интерфейса: редактор добавя тема → обработка (реални записани отговори на Уикипедия
 * от локален сървър) → източници с версия и лиценз → без ключ за AI: „Чака настройка“ → ръчна чернова →
 * проверките не пускат шаблон за публикуване. Ученик няма достъп.
 */
const ADMIN = `pipeline-admin-${Date.now()}@example.bg`;
const PASS = "АдминПарола2026";
const TOPIC = "Княз Борис I и покръстването";

test.describe.configure({ mode: "serial" });

async function cleanup() {
  const items = await query<{ lessonId: string | null }>(
    `select pi."lessonId" from "PipelineItem" pi join "CurriculumTopic" t on t.id = pi."topicId" where t.title = $1`,
    [TOPIC],
  );
  await query(`delete from "PipelineItem" where "topicId" in (select id from "CurriculumTopic" where title = $1)`, [TOPIC]);
  const lessons = items.map((i) => i.lessonId).filter(Boolean);
  if (lessons.length) await query(`delete from "Lesson" where id = any($1)`, [lessons]);
}

test.afterAll(cleanup);

test.beforeAll(async () => {
  execSync(`npx tsx scripts/create-admin.ts ${ADMIN} "${PASS}" "Pipeline Админ"`, {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    stdio: "pipe",
  });
  // чисто начало: без предишни задачи и чернови за темата
  await cleanup();
});

test("редактор: тема → източник → извличане → чака AI ключ → ръчна чернова → проверките спират шаблона", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(ADMIN);
  await page.getByLabel("Парола").fill(PASS);
  await page.getByRole("button", { name: "Вход" }).click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/);

  await page.goto("/admin/pipeline");
  await expect(page.getByRole("heading", { name: "Pipeline за съдържание" })).toBeVisible();
  await expect(page.getByText(/ANTHROPIC_API_KEY липсва/)).toBeVisible();

  await page.getByLabel("Търси тема").fill("покръстването");
  await page.getByRole("button", { name: "Търси" }).click();
  const row = page.locator("li", { hasText: TOPIC }).first();
  await row.getByRole("button", { name: "Добави" }).click();
  await expect(page.getByText("Задачата е добавена в опашката.")).toBeVisible();
  await expect(page.getByText("Чака откриване").first()).toBeVisible();

  await page.getByRole("button", { name: "Обработи опашката сега" }).click();
  await expect(page.getByText("Чака настройка", { exact: true }).first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Генерирането на урок изисква ANTHROPIC_API_KEY/).first()).toBeVisible();
  // източниците: реалните статии, версия, лиценз, авторство
  await expect(page.getByRole("link", { name: "Борис I", exact: true })).toHaveAttribute("href", "https://bg.wikipedia.org/w/index.php?oldid=12918817");
  await expect(page.getByRole("link", { name: "Покръстване на България" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "CC BY-SA 4.0" }).first()).toBeVisible();
  await expect(page.getByText(/Автори: участниците в Уикипедия/).first()).toBeVisible();
  // ново извличане или повторно използване на вече извлечената същата версия (без дубликат)
  await expect(page.getByText(/Извлечен „Борис I“, версия 12918817|„Борис I“ \(версия 12918817\) вече е извлечен/)).toBeVisible();

  // ръчна чернова по извлечения източник → редакторът на уроци
  await page.getByRole("button", { name: "Напиши урока ръчно" }).click();
  await expect(page).toHaveURL(/\/admin\/lessons\/.+\?pipeline=/);
  await expect(page.getByLabel("Изходен текст на урока")).toHaveValue(/wikipedia-bg-46810/);
  const itemId = new URL(page.url()).searchParams.get("pipeline")!;

  await page.goto(`/admin/pipeline/${itemId}`);
  await page.getByRole("button", { name: "Провери отново" }).click();
  await expect(page.getByText("Проверките са изпълнени отново.")).toBeVisible();
  await expect(page.getByText("Проверките откриха проблеми").first()).toBeVisible();
  await expect(page.getByText(/неподменен шаблонен текст/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Одобри и публикувай" })).toBeDisabled();

  // черновата не е видима за учащите
  const [lesson] = await query<{ status: string }>(`select l.status from "Lesson" l join "PipelineItem" p on p."lessonId" = l.id where p.id = $1`, [itemId]);
  expect(lesson.status).toBe("DRAFT");
  const audit = await query(`select 1 from "AuditLog" where action = 'pipeline.create' and "entityId" = $1`, [itemId]);
  expect(audit).toHaveLength(1);
});

test("ученик няма достъп до pipeline-а", async ({ page }) => {
  await register(page);
  await completeOnboarding(page);
  await page.goto("/admin/pipeline");
  await expect(page).toHaveURL(/forbidden=1/);
});
