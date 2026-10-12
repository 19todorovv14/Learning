const DISPLAY_LINE = /^(\s*)\$\$(.+?)\$\$\s*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Ред, който съдържа само `$$…$$`, се превръща в блокова формула (`$$` на отделни редове),
 * защото remark-math приема `$$…$$` на един ред за вградена формула. Кодовите блокове не се пипат.
 */
export function normalizeDisplayMath(src: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of src.split("\n")) {
    const f = line.match(FENCE);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1] === fence) fence = null;
      out.push(line);
      continue;
    }
    const m = fence ? null : line.match(DISPLAY_LINE);
    if (!m) {
      out.push(line);
      continue;
    }
    const indent = m[1];
    if (out.length && out[out.length - 1].trim() !== "") out.push("");
    out.push(`${indent}$$`, `${indent}${m[2].trim()}`, `${indent}$$`, "");
  }
  return out.join("\n");
}
