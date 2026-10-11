import "dotenv/config";
import { join } from "node:path";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { loadContent } from "../src/lib/content/load";
import { importContent } from "../src/lib/content/import";
import { importDrivingCategories, importUniversities, importVocational } from "../src/lib/content/import-reference";

async function main() {
  const db = createPrismaClient();
  const root = join(process.cwd(), "content");
  const t0 = Date.now();
  try {
    console.log("→ Професионално образование (СППОО)…");
    await importVocational(db, root, console.log);
    console.log("→ Шофьорски категории…");
    console.log(`  ${await importDrivingCategories(db, root)} категории`);
    console.log("→ Висши училища и специалности (НАЦИД)…");
    await importUniversities(db, root, console.log);

    console.log("→ Учебно съдържание…");
    const bundle = loadContent(root);
    if (bundle.errors.length) {
      console.error(`✖ ${bundle.errors.length} грешки в съдържанието:\n` + bundle.errors.join("\n"));
      process.exitCode = 1;
      return;
    }
    const report = await importContent(db, bundle, { force: process.argv.includes("--force") });
    console.log(
      `  предмети: ${report.subjects}, източници: ${report.sources}, програми: ${report.curricula}, ` +
        `уроци: +${report.lessonsCreated} нови, ${report.lessonsUpdated} обновени, ${report.lessonsUnchanged} без промяна`,
    );
    for (const w of [...report.warnings, ...report.lessonsSkipped]) console.warn("  ⚠ " + w);

    if (process.env.ADMIN_EMAIL) {
      const u = await db.user.updateMany({ where: { email: process.env.ADMIN_EMAIL.toLowerCase() }, data: { role: "ADMIN" } });
      if (u.count) console.log(`→ ${process.env.ADMIN_EMAIL} е администратор`);
    }
    console.log(`✔ Готово за ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
