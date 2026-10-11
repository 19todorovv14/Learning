import { loadContent } from "../src/lib/content/load";

const bundle = loadContent();
const q = bundle.lessons.reduce((n, l) => n + l.questions.length, 0);
console.log(
  `Предмети: ${bundle.subjects.length} · Програми: ${bundle.curricula.length} · Теми: ${bundle.curricula.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.topics.length, 0), 0)} · Уроци: ${bundle.lessons.length} · Въпроси: ${q}`,
);
if (bundle.errors.length) {
  console.error(`\n✖ ${bundle.errors.length} грешки:\n\n` + bundle.errors.join("\n\n"));
  process.exit(1);
}
console.log("✔ Съдържанието е валидно.");
