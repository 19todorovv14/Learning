import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Въведете валиден имейл адрес.");

export const passwordSchema = z
  .string()
  .min(10, "Паролата трябва да е поне 10 символа.")
  .max(200, "Паролата е твърде дълга.")
  .refine((p) => /[a-zA-Zа-яА-Я]/.test(p) && /[0-9]/.test(p), "Използвайте поне една буква и една цифра.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Името трябва да е поне 2 символа.")
  .max(60, "Името е твърде дълго.");

export const registerSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  ageGroup: z.enum(["UNDER_14", "FROM_14_TO_17", "ADULT"], { message: "Изберете възрастова група." }),
  acceptTerms: z.literal("on", { message: "Трябва да приемете условията и политиката за поверителност." }),
  parentConsent: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Въведете парола.").max(200),
});

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
};

export function formToObject(fd: FormData) {
  const obj: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}
