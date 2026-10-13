import { describe, expect, it } from "vitest";
import { isAllowedByRobots, parseRobots } from "@/lib/robots";

// Откъси от реалните robots.txt (проверени на 13.10.2026)
const CIELA = "User-agent: Googlebot\nAllow: /\nUser-agent: Bingbot\nAllow: /\nUser-agent: *\nDisallow: /";
const WIKIPEDIA = "User-agent: *\nAllow: /w/api.php?action=mobileview&\nAllow: /w/load.php?\nAllow: /api/rest_v1/?doc\nDisallow: /w/\nDisallow: /api/\nDisallow: /trap/";
const NAVET = "User-agent: *\nDisallow: /bg/*%*";

describe("robots.txt", () => {
  it("Ciela забранява всички ботове освен изброените търсачки", () => {
    const g = parseRobots(CIELA);
    expect(isAllowedByRobots(g, "bg-learn", "/svobodna-zona-normativi/view/2136641509/zakon")).toBe(false);
    expect(isAllowedByRobots(g, "googlebot", "/svobodna-zona-normativi/view/2136641509/zakon")).toBe(true);
  });

  it("Уикипедия: статиите /wiki/ са позволени, /w/ не е (освен изключенията)", () => {
    const g = parseRobots(WIKIPEDIA);
    expect(isAllowedByRobots(g, "bg-learn", "/wiki/%D0%90%D1%82%D0%BE%D0%BC")).toBe(true);
    expect(isAllowedByRobots(g, "bg-learn", "/w/index.php?title=X&action=history")).toBe(false);
    expect(isAllowedByRobots(g, "bg-learn", "/w/api.php?action=mobileview&page=X")).toBe(true);
  });

  it("НАПОО: забранени са само адресите с %", () => {
    const g = parseRobots(NAVET);
    expect(isAllowedByRobots(g, "bg-learn", "/bg/spisak-na-profesiite-za-poo/")).toBe(true);
    expect(isAllowedByRobots(g, "bg-learn", "/bg/media/%D0%B0.pdf")).toBe(false);
  });

  it("най-дългото правило печели; при равенство — Allow; $ закотвя края", () => {
    const g = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a/b\nDisallow: /*.pdf$");
    expect(isAllowedByRobots(g, "x", "/a/c")).toBe(false);
    expect(isAllowedByRobots(g, "x", "/a/b/c")).toBe(true);
    expect(isAllowedByRobots(g, "x", "/doc.pdf")).toBe(false);
    expect(isAllowedByRobots(g, "x", "/doc.pdf?x=1")).toBe(true);
    expect(isAllowedByRobots(parseRobots(""), "x", "/anything")).toBe(true);
  });
});
