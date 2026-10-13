/** Кандидат от търсене при източника. */
export type Candidate = {
  externalId: string;
  title: string;
  url: string;
  rank: number; // позиция в резултатите на източника (1 = най-уместен)
  size: number;
  disambiguation: boolean;
  revisionId: string | null;
};

/** Извлечен документ — текст и всичко за произхода му. */
export type FetchedDocument = {
  externalId: string;
  revisionId: string | null;
  revisedAt: Date | null;
  title: string;
  canonicalUrl: string;
  url: string; // постоянен адрес на тази версия
  language: string;
  text: string;
  license: string;
  licenseUrl: string | null;
  attribution: string;
  httpStatus: number;
};

/**
 * Доставчик на източници. Добавя се само за източници с позволен автоматичен достъп
 * (публичен API или изрично разрешение) и ясен лиценз.
 */
export type SourceProvider = {
  key: string;
  label: string;
  organization: string;
  language: string;
  accessBasis: string;
  search(query: string, limit?: number): Promise<Candidate[]>;
  fetch(externalId: string): Promise<FetchedDocument>;
};
