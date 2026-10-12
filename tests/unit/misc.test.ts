import { describe, expect, it } from "vitest";
import { parseSearchQuery, toPrefixTsQuery } from "@/lib/search/parse";
import { isSafeRedirect, plural, slugify } from "@/lib/utils";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import { validateImage } from "@/lib/ai/image";
import { estimateCostMicroUsd } from "@/lib/ai/config";
import { registerSchema, passwordSchema } from "@/lib/validation";
import { normalizeDisplayMath } from "@/components/markdown/normalize-math";

describe("търсене на естествен език", () => {
  it("разпознава клас, предмет и намерение", () => {
    const p = parseSearchQuery("Обясни ми фотосинтезата за 7. клас");
    expect(p.grade).toBe(7);
    expect(p.subjectSlug).toBe("biologiya");
    expect(p.intent).toBe("explain");
    expect(p.terms).toEqual(["фотосинтезата"]);
  });
  it("„Изпитай ме по история за Възраждането“", () => {
    const p = parseSearchQuery("Изпитай ме по история за Възраждането");
    expect(p.intent).toBe("quiz");
    expect(p.subjectSlug).toBe("istoriya");
  });
  it("„Какви изпити ми трябват за тази специалност?“ → прием", () => {
    expect(parseSearchQuery("Какви изпити ми трябват за тази специалност?").intent).toBe("admission");
  });
  it("клас с „-ми“ и 12. клас", () => {
    expect(parseSearchQuery("матура 12-ти клас").grade).toBe(12);
    expect(parseSearchQuery("дроби 5 клас").grade).toBe(5);
  });
  it("префиксна заявка отрязва окончанията", () => {
    expect(toPrefixTsQuery(["фотосинтезата"])).toBe("фотосинтез:*");
    expect(toPrefixTsQuery(["ток", "x"])).toBe("ток:*");
  });
});

describe("utils", () => {
  it("slugify транслитерира по закона", () => {
    expect(slugify("Формули за съкратено умножение")).toBe("formuli-za-sakrateno-umnozhenie");
    expect(slugify("Щастие и юнак")).toBe("shtastie-i-yunak");
  });
  it("isSafeRedirect спира външни пренасочвания", () => {
    expect(isSafeRedirect("/dashboard")).toBe(true);
    expect(isSafeRedirect("//evil.com")).toBe(false);
    expect(isSafeRedirect("https://evil.com")).toBe(false);
    expect(isSafeRedirect("/\\evil.com")).toBe(false);
  });
  it("plural", () => {
    expect(plural(1, "урок", "урока")).toBe("1 урок");
    expect(plural(3, "урок", "урока")).toBe("3 урока");
  });
});

describe("сигурност", () => {
  it("токените са случайни и достатъчно дълги", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z2-7]{40}$/);
    expect(hashToken(a)).toHaveLength(64);
    expect(hashToken(a)).toBe(hashToken(a));
  });
  it("изображенията се проверяват по съдържание, не по разширение", () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]).toString("base64");
    expect(validateImage(png)?.mediaType).toBe("image/png");
    const fake = Buffer.from("<script>alert(1)</script>............").toString("base64");
    expect(validateImage(fake)).toBeNull();
    expect(validateImage("не е base64!")).toBeNull();
  });
  it("валидация на паролата и регистрацията", () => {
    expect(passwordSchema.safeParse("кратка1").success).toBe(false);
    expect(passwordSchema.safeParse("дългапаролабезцифри").success).toBe(false);
    expect(passwordSchema.safeParse("ДългаПарола2026").success).toBe(true);
    const r = registerSchema.safeParse({ displayName: "Иван", email: " IVAN@Example.BG ", password: "ДългаПарола2026", ageGroup: "ADULT", acceptTerms: "on" });
    expect(r.success && r.data.email).toBe("ivan@example.bg");
    expect(registerSchema.safeParse({ displayName: "Иван", email: "x@y.bg", password: "ДългаПарола2026", ageGroup: "ADULT" }).success).toBe(false);
  });
});

describe("разходи за AI", () => {
  it("изчислява цената по токени", () => {
    // 1M входни ($4) + 100k изходни ($2) = $6
    expect(estimateCostMicroUsd("claude-opus-5-5", { input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0 })).toBe(6_000_000);
    expect(estimateCostMicroUsd("непознат-модел", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(4_000_000);
  });
});

describe("normalizeDisplayMath", () => {
  it("превръща ред с $$…$$ в блокова формула", () => {
    const out = normalizeDisplayMath(":::formula[Т]\n$$a^2 + b^2 = c^2$$\n**текст**\n:::");
    expect(out).toBe(":::formula[Т]\n\n$$\na^2 + b^2 = c^2\n$$\n\n**текст**\n:::");
  });
  it("не пипа вградени формули и кодови блокове", () => {
    expect(normalizeDisplayMath("Текст $x$ и $$y$$ в изречение.")).toBe("Текст $x$ и $$y$$ в изречение.");
    const code = "```\n$$x$$\n```";
    expect(normalizeDisplayMath(code)).toBe(code);
  });
});
