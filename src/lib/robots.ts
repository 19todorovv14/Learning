/**
 * Минимален анализ на robots.txt по RFC 9309: група за нашия агент (или „*“), правила Allow/Disallow
 * с „*“ и „$“, най-дългото съвпадение печели, при равенство — Allow.
 * Липсващ robots.txt (4xx) = всичко е позволено; грешка 5xx или липса на връзка = нищо не е позволено.
 */

type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[] };

export function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  return groups;
}

function matches(pattern: string, path: string) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Позволен ли е пътят за агента (напр. "bg-learn"). */
export function isAllowedByRobots(groups: Group[], agent: string, pathWithQuery: string) {
  const a = agent.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((x) => x !== "*" && a.includes(x)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules).filter((r) => matches(r.pattern, pathWithQuery));
  if (!rules.length) return true;
  rules.sort((x, y) => y.pattern.length - x.pattern.length || Number(y.allow) - Number(x.allow));
  return rules[0].allow;
}

const cache = new Map<string, { groups: Group[] | "ALL" | "NONE"; at: number }>();

export async function robotsAllows(url: string, agent = "bg-learn", userAgent = "BG-LEARN-LinkCheck/1.0") {
  const u = new URL(url);
  const hit = cache.get(u.origin);
  let entry = hit && Date.now() - hit.at < 3600_000 ? hit : null;
  if (!entry) {
    let groups: Group[] | "ALL" | "NONE";
    try {
      const res = await fetch(`${u.origin}/robots.txt`, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(10_000), redirect: "follow" });
      groups = res.status >= 500 ? "NONE" : res.status >= 400 ? "ALL" : parseRobots(await res.text());
    } catch {
      groups = "NONE";
    }
    entry = { groups, at: Date.now() };
    cache.set(u.origin, entry);
  }
  if (entry.groups === "ALL") return true;
  if (entry.groups === "NONE") return false;
  return isAllowedByRobots(entry.groups, agent, u.pathname + u.search);
}
