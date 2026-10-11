import "dotenv/config";
import { execSync } from "node:child_process";

/** Общо за Vitest и Playwright: подготвя отделната тестова база (DATABASE_URL_TEST). */
export default async function setup() {
  if (!process.env.DATABASE_URL_TEST) {
    console.warn("DATABASE_URL_TEST не е зададен — тестовете с база ще бъдат пропуснати.");
    return;
  }
  execSync("npx tsx scripts/prepare-test-db.ts", { stdio: "inherit" });
}
