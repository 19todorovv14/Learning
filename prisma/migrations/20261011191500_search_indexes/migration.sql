-- Търсене: триграми за размито съвпадение + пълнотекстови индекси (конфигурация 'simple',
-- защото PostgreSQL няма вграден български stemmer).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Lesson_title_trgm_idx" ON "Lesson" USING GIN (lower("title") gin_trgm_ops);
-- array_to_string е STABLE; обвиваме го като IMMUTABLE за използване в индекс.
CREATE OR REPLACE FUNCTION bgl_join_text(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, ' ') $$;

CREATE INDEX IF NOT EXISTS "Lesson_fts_idx" ON "Lesson" USING GIN (
  to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("summary", '') || ' ' || bgl_join_text("keywords"))
);
CREATE INDEX IF NOT EXISTS "LessonSection_fts_idx" ON "LessonSection" USING GIN (to_tsvector('simple', "body"));
CREATE INDEX IF NOT EXISTS "LessonTerm_term_trgm_idx" ON "LessonTerm" USING GIN (lower("term") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CurriculumTopic_title_trgm_idx" ON "CurriculumTopic" USING GIN (lower("title") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "University_name_trgm_idx" ON "University" USING GIN (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Program_name_trgm_idx" ON "Program" USING GIN (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "School_name_trgm_idx" ON "School" USING GIN (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "VocationalSpecialty_name_trgm_idx" ON "VocationalSpecialty" USING GIN (lower("name") gin_trgm_ops);
