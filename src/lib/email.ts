import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";

type Mail = { to: string; subject: string; text: string };

let transporter: Transporter | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export function isEmailConfigured() {
  return !!process.env.SMTP_HOST;
}

export async function sendEmail(mail: Mail) {
  const t = getTransporter();
  if (t) {
    await t.sendMail({ from: process.env.SMTP_FROM || "BG LEARN <no-reply@localhost>", ...mail });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    // В production без SMTP не можем да изпратим писмо — не записваме токени никъде.
    console.error("[email] SMTP не е конфигуриран — писмото не е изпратено:", mail.subject);
    return;
  }
  // Development: писмата се показват в /dev/mailbox
  await db.devEmail.create({ data: mail });
  console.info(`[email:dev] → ${mail.to}: ${mail.subject}\n${mail.text}`);
}
