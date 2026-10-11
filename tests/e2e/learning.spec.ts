import { expect, test } from "@playwright/test";
import { completeOnboarding, PASSWORD, register } from "./helpers";

const LESSON = "/lessons/matematika-7-formuli-za-sakrateno-umnozhenie";

test("публичната начална страница и демо урок", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Разбери всичко, което учиш." })).toBeVisible();
  await page.getByRole("link", { name: "Виж примерен урок" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Формули за съкратено умножение");
  await expect(page.getByText("Урокът още не е проверен от преподавател")).toBeVisible();
});

test("защитените страници пренасочват към вход", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("регистрация, onboarding, урок, тест и резултат", async ({ page }) => {
  const email = await register(page);
  await completeOnboarding(page, 7);
  await expect(page.getByRole("heading", { name: /Мария/ })).toBeVisible();
  await expect(page.getByText("Потвърдете имейла си")).toBeVisible();

  // Потвърждение на имейла през тестовата пощенска кутия
  await page.goto("/dev/mailbox");
  const mail = page.getByTestId("dev-email").filter({ hasText: email }).first();
  const text = await mail.getByTestId("dev-email-text").innerText();
  const link = text.match(/https?:\/\/\S+verify-email\?token=\S+/)![0];
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.getByText("Имейлът е потвърден!")).toBeVisible();

  // Урок в двата режима
  await page.goto(LESSON);
  await expect(page.getByRole("heading", { name: "Обяснение" })).toBeVisible();
  const modes = page.getByRole("navigation", { name: "Режим на урока" });
  await modes.getByRole("link", { name: /Уча за училище/ }).click();
  await expect(page.getByRole("heading", { name: "Записки за тетрадката" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Въпроси, които учителят може да зададе" })).toBeVisible();
  await page.getByRole("button", { name: "Добави в любими" }).click();
  await expect(page.getByRole("button", { name: "В любими" })).toBeVisible();

  // Тест в режим упражнение
  await modes.getByRole("link", { name: /Упражнения и тест/ }).click();
  await page.getByRole("button", { name: "Упражнение" }).click();
  await expect(page).toHaveURL(/\/quiz\//);
  await expect(page.getByText("Въпрос 1 от")).toBeVisible();
  // KaTeX пази TeX източника в скрита анотация — избираме видимия етикет на отговора
  await page.locator("label").filter({ hasText: "x^2 + 6x + 9" }).click();
  await page.getByRole("button", { name: "Провери" }).click();
  await expect(page.getByText("Вярно!")).toBeVisible();
  // отиваме на последния въпрос и предаваме
  const total = Number((await page.getByText(/Въпрос 1 от \d+/).innerText()).match(/от (\d+)/)![1]);
  await page.getByRole("button", { name: `Въпрос ${total}` }).click();
  await page.getByRole("button", { name: "Предай теста" }).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByRole("heading", { name: "Преглед на отговорите" })).toBeVisible();
  await expect(page.getByText("Препоръчани уроци за преговор")).toBeVisible();

  // Прогресът се вижда в таблото
  await page.goto("/dashboard");
  await expect(page.getByText("Последни тестове")).toBeVisible();

  // Изход и повторен вход
  await page.getByRole("button", { name: "Профил" }).click();
  await page.getByRole("menuitem", { name: "Изход" }).click();
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("ученик няма достъп до администрацията; грешна парола се отказва", async ({ page }) => {
  await register(page);
  await completeOnboarding(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard\?forbidden=1/);
  await expect(page.getByText("Нямаш достъп до тази страница.")).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Имейл").fill("nobody@example.bg");
  await page.getByLabel("Парола").fill("грешна-парола-123");
  await page.getByRole("button", { name: "Вход" }).click();
  await expect(page.getByText("Грешен имейл или парола.")).toBeVisible();
});

test("търсене, записки, преговор и AI учител без ключ", async ({ page }) => {
  await register(page);
  await completeOnboarding(page);

  await page.goto("/search?q=" + encodeURIComponent("квадрат на сбор 7 клас"));
  await expect(page.getByRole("link", { name: /Формули за съкратено умножение/ }).first()).toBeVisible();

  await page.goto("/notes");
  await page.getByPlaceholder("Заглавие").fill("Моята записка");
  await page.locator('textarea[name="body"]').fill("Формула: $a^2+b^2=c^2$");
  await page.getByRole("button", { name: "Запази" }).click();
  await expect(page.getByRole("heading", { name: "Моята записка" })).toBeVisible();

  await page.goto(LESSON + "?mode=learn");
  await page.getByRole("button", { name: /Преговаряй определенията/ }).click();
  await expect(page.getByText(/Добавени \d+ карти/)).toBeVisible();
  await page.goto("/review");
  await page.getByRole("button", { name: "Покажи отговора" }).click();
  await page.getByRole("button", { name: /Добре/ }).click();

  await page.goto("/tutor");
  await expect(page.getByText("AI учителят не е активиран на този сървър")).toBeVisible();
});

test("университети и професии от официалните регистри", async ({ page }) => {
  await page.goto("/universities");
  await page.getByRole("link", { name: /Софийски университет/ }).click();
  await expect(page.getByRole("heading", { name: "Специалности" })).toBeVisible();
  await page.goto("/vocational?q=" + encodeURIComponent("Автомобилна"));
  await expect(page.getByRole("link", { name: /Автомобилна техника и мехатроника/ })).toBeVisible();
});
