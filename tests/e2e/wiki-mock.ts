import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

/**
 * Локален сървър за e2e тестовете, който връща РЕАЛНИ записани отговори на API на Уикипедия
 * (tests/fixtures/wikipedia) — без мрежа и без натоварване на Уикипедия.
 */
const dir = join(process.cwd(), "tests/fixtures/wikipedia");
const file = (f: string) => readFileSync(join(dir, f), "utf8");
const port = Number(process.env.WIKI_MOCK_PORT ?? 3199);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/health") {
    res.end("ok");
    return;
  }
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  if (url.searchParams.get("generator") === "search") return res.end(file("search-boris-pokrastvane.json"));
  const id = url.searchParams.get("pageids");
  if (id === "46810") return res.end(file("page-46810-boris-i.json"));
  if (id === "134079") return res.end(file("page-134079-pokrastvane.json"));
  res.end(JSON.stringify({ query: { pages: [{ pageid: Number(id), missing: true, title: "?" }] } }));
}).listen(port, "127.0.0.1", () => console.log(`wiki mock на :${port}`));
