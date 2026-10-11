import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { loadContent } from "../src/lib/content/load";
import { importContent } from "../src/lib/content/import";

async function main() {
  const bundle = loadContent();
  if (bundle.errors.length) {
    console.error(bundle.errors.join("\n"));
    process.exit(1);
  }
  const db = createPrismaClient();
  try {
    const r = await importContent(db, bundle, { force: process.argv.includes("--force"), log: (s) => console.log("  " + s) });
    console.log(`✔ +${r.lessonsCreated} нови, ${r.lessonsUpdated} обновени, ${r.lessonsUnchanged} без промяна`);
    for (const w of [...r.warnings, ...r.lessonsSkipped]) console.warn("⚠ " + w);
  } finally {
    await db.$disconnect();
  }
}
main();
