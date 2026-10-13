import "dotenv/config";
import { writeFileSync } from "node:fs";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { computeCoverage, coverageMarkdown } from "../src/lib/coverage";

/** Генерира docs/COVERAGE.md от реалните данни в базата. */
const db = createPrismaClient();
computeCoverage(db)
  .then((c) => {
    writeFileSync("docs/COVERAGE.md", coverageMarkdown(c));
    console.log(`✔ docs/COVERAGE.md · уроци ${c.lessons.total} (проверени ${c.lessons.verified}) · училищни теми с урок ${c.schoolTopics.covered}/${c.schoolTopics.total}`);
  })
  .finally(() => db.$disconnect());
