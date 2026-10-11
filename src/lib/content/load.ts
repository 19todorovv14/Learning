import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ContentError, parseLessonFile } from "./parse-lesson";
import {
  curriculumSchema,
  sourceSchema,
  subjectSchema,
  type CurriculumFile,
  type ParsedLesson,
  type SourceFile,
} from "./types";

export type SubjectFile = z.infer<typeof subjectSchema>;

export type ContentBundle = {
  root: string;
  subjects: SubjectFile[];
  sources: SourceFile[];
  curricula: (CurriculumFile & { file: string })[];
  lessons: (ParsedLesson & { raw: string })[];
  errors: string[];
};

function walk(dir: string, ext: string): string[] {
  let out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries.sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p, ext));
    else if (name.endsWith(ext) && !name.startsWith("_")) out.push(p);
  }
  return out;
}

function readYaml(path: string) {
  return parseYaml(readFileSync(path, "utf8")) as unknown;
}

export function loadContent(root = join(process.cwd(), "content")): ContentBundle {
  const errors: string[] = [];

  const subjectsRaw = readYaml(join(root, "subjects.yaml"));
  const subjectsParsed = z.array(subjectSchema).safeParse(subjectsRaw);
  const subjects = subjectsParsed.success ? subjectsParsed.data : [];
  if (!subjectsParsed.success) errors.push(`subjects.yaml: ${z.prettifyError(subjectsParsed.error)}`);

  const sourcesRaw = readYaml(join(root, "sources.yaml"));
  const sourcesParsed = z.array(sourceSchema).safeParse(sourcesRaw);
  const sources = sourcesParsed.success ? sourcesParsed.data : [];
  if (!sourcesParsed.success) errors.push(`sources.yaml: ${z.prettifyError(sourcesParsed.error)}`);

  const subjectSlugs = new Set(subjects.map((s) => s.slug));
  const sourceKeys = new Set(sources.map((s) => s.key));
  dupCheck(subjects.map((s) => s.slug), "subjects.yaml: повторен slug", errors);
  dupCheck(sources.map((s) => s.key), "sources.yaml: повторен key", errors);
  dupCheck(sources.map((s) => s.url), "sources.yaml: повторен url", errors);

  const curricula: ContentBundle["curricula"] = [];
  for (const file of walk(join(root, "curricula"), ".yaml")) {
    const rel = relative(root, file);
    const parsed = curriculumSchema.safeParse(readYaml(file));
    if (!parsed.success) {
      errors.push(`${rel}: ${z.prettifyError(parsed.error)}`);
      continue;
    }
    const c = parsed.data;
    if (!subjectSlugs.has(c.subject)) errors.push(`${rel}: непознат предмет „${c.subject}“`);
    if (c.source && !sourceKeys.has(c.source)) errors.push(`${rel}: непознат източник „${c.source}“`);
    if (c.track === "SCHOOL" && !c.grade) errors.push(`${rel}: училищна програма без „grade“`);
    const topicTitles = c.sections.flatMap((s) => s.topics);
    dupCheck(topicTitles, `${rel}: повторена тема`, errors);
    dupCheck(c.sections.map((s) => s.title), `${rel}: повторен раздел`, errors);
    curricula.push({ ...c, file: rel });
  }
  dupCheck(curricula.map((c) => c.slug), "curricula: повторен slug", errors);

  const bySlug = new Map(curricula.map((c) => [c.slug, c]));
  const lessons: ContentBundle["lessons"] = [];
  for (const file of walk(join(root, "lessons"), ".md")) {
    const rel = relative(root, file);
    const raw = readFileSync(file, "utf8");
    try {
      const lesson = parseLessonFile(rel, raw, basename(file, ".md"));
      const c = bySlug.get(lesson.meta.curriculum);
      if (!c) errors.push(`${rel}: непозната програма „${lesson.meta.curriculum}“`);
      else if (!c.sections.some((s) => s.topics.includes(lesson.meta.topic)))
        errors.push(`${rel}: темата „${lesson.meta.topic}“ я няма в програмата „${c.slug}“`);
      for (const a of lesson.meta.also) {
        const [cs, topic] = a.split("|");
        const ac = bySlug.get(cs);
        if (!ac) errors.push(`${rel}: also → непозната програма „${cs}“`);
        else if (!ac.sections.some((s) => s.topics.includes(topic)))
          errors.push(`${rel}: also → темата „${topic}“ я няма в „${cs}“`);
      }
      for (const s of lesson.meta.sources) if (!sourceKeys.has(s)) errors.push(`${rel}: непознат източник „${s}“`);
      lessons.push({ ...lesson, raw });
    } catch (e) {
      if (e instanceof ContentError) errors.push(e.message);
      else errors.push(`${rel}: ${(e as Error).message}`);
    }
  }
  dupCheck(lessons.map((l) => l.slug), "lessons: повторен slug", errors);

  return { root, subjects, sources, curricula, lessons, errors };
}

function dupCheck(values: string[], message: string, errors: string[]) {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) errors.push(`${message}: „${v}“`);
    seen.add(v);
  }
}
