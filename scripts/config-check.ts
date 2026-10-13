import "dotenv/config";
import { configReport } from "../src/lib/config/report";
import { aiConfig } from "../src/lib/ai/config";
import { verifyAnthropicKey } from "../src/lib/ai/client";

/**
 * Проверка на настройките на сървъра — без да показва стойностите на тайните.
 *   npm run config:check                 — само наличие и валидност
 *   npm run config:check -- --verify-key — плюс проверка на ANTHROPIC_API_KEY срещу API (GET /v1/models, без токени и без разход)
 */
const ICON = { ok: "✔", missing: "–", invalid: "✖", warning: "!" } as const;

async function main() {
  const rows = configReport();
  for (const r of rows) console.log(`${ICON[r.status]} ${r.name.padEnd(28)} ${r.message}${r.secret && r.status === "ok" ? " (стойността не се показва)" : ""}`);
  let failed = rows.some((r) => r.status === "invalid");
  if (process.argv.includes("--verify-key")) {
    const cfg = aiConfig();
    if (!cfg.hasCredentials) {
      console.log("✖ Проверка на ключа: няма зададен ключ");
      failed = true;
    } else {
      const res = await verifyAnthropicKey(cfg.model);
      console.log(res.ok ? `✔ Проверка на ключа: валиден, моделът ${res.model} е достъпен (без разход)` : `✖ Проверка на ключа: ${res.reason}`);
      if (!res.ok) failed = true;
    }
  }
  process.exitCode = failed ? 1 : 0;
}
main();
