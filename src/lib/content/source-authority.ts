import type { SourceType } from "@/generated/prisma/enums";

/**
 * Официални документи (нормативни актове, учебни програми, регистри, материали на институцията, която провежда изпита)
 * срещу справочни материали (енциклопедии като Уикипедия, други сайтове). Справочният материал помага за обяснението,
 * но НЕ е учебна програма, учебник или официално изискване.
 */
const OFFICIAL: SourceType[] = [
  "OFFICIAL_CURRICULUM",
  "EDUCATION_STANDARD",
  "EXAM_MATERIAL",
  "LEGISLATION",
  "REGISTER",
  "DRIVING_OFFICIAL",
  "FIRST_AID_OFFICIAL",
  "UNIVERSITY_PAGE",
  "ADMISSION_GUIDE",
];

export type SourceAuthority = "official" | "reference";

export function sourceAuthority(type: SourceType): SourceAuthority {
  return OFFICIAL.includes(type) ? "official" : "reference";
}

export const AUTHORITY_LABEL: Record<SourceAuthority, string> = {
  official: "Официален документ",
  reference: "Справочен материал — не е официален учебен документ",
};
