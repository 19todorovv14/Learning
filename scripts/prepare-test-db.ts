// Подготвя тестовата база: миграции, справочни данни и учебно съдържание.
import "dotenv/config";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { loadContent } from "../src/lib/content/load";
import { importContent } from "../src/lib/content/import";
import { importDrivingCategories, importUniversities, importVocational } from "../src/lib/content/import-reference";

async function main() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST не е зададен");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  const db = createPrismaClient(url);
  const root = join(process.cwd(), "content");
  try {
    if ((await db.vocationalProfession.count()) === 0) await importVocational(db, root);
    if ((await db.university.count()) === 0) await importUniversities(db, root);
    await importDrivingCategories(db, root);
    const bundle = loadContent(root);
    if (bundle.errors.length) throw new Error("Невалидно съдържание:\n" + bundle.errors.join("\n"));
    await importContent(db, bundle, { force: true });
    // Нулираме ограниченията на заявките (тестовете регистрират много потребители от един адрес)
    await db.rateLimitBucket.deleteMany();
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
