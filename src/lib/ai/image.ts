import type { TutorImage } from "./tutor";

const MAX_BYTES = 5 * 1024 * 1024;

/** Проверява реалния тип на изображението по „магическите байтове“, а не по заявения тип. */
export function validateImage(base64: string): TutorImage | null {
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) return null;
  const clean = base64.replace(/\s/g, "");
  const bytes = Buffer.from(clean, "base64");
  if (bytes.length < 16 || bytes.length > MAX_BYTES) return null;
  let mediaType: TutorImage["mediaType"] | null = null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) mediaType = "image/png";
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mediaType = "image/jpeg";
  else if (bytes.subarray(0, 4).toString("ascii") === "GIF8") mediaType = "image/gif";
  else if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP")
    mediaType = "image/webp";
  if (!mediaType) return null;
  return { mediaType, data: clean };
}
