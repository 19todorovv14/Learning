import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";
import { cleanupRateLimits } from "@/lib/rate-limit";
import { sofiaDay } from "@/lib/data/progress";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Ежедневни напомняния по имейл (само за потребители, които са ги включили).
 * Извиква се от планировчик: curl -H "Authorization: Bearer $CRON_SECRET" -X POST $APP_URL/api/cron/reminders
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Неоторизиран достъп." }, { status: 401 });
  const today = sofiaDay(new Date());
  const users = await db.user.findMany({
    where: { emailVerifiedAt: { not: null }, preferences: { emailReminders: true } },
    select: { id: true, email: true, displayName: true },
    take: 5000,
  });
  let sent = 0;
  for (const u of users) {
    const due = await db.reviewState.count({ where: { userId: u.id, dueAt: { lte: new Date() } } });
    if (due < 5) continue;
    const marker = await db.notification
      .create({ data: { userId: u.id, type: "REVIEW_DUE", title: "Напомняне по имейл", body: `${due} карти`, dedupeKey: `email:review:${today}`, readAt: new Date() } })
      .catch(() => null);
    if (!marker) continue; // вече е изпратено днес
    await sendEmail({
      to: u.email,
      subject: `Имаш ${due} карти за преговор`,
      text: `Здравей, ${u.displayName}!\n\nИмаш ${due} карти за преговор днес — отнема няколко минути:\n${appUrl("/review")}\n\nМожеш да изключиш напомнянията от Профил и настройки: ${appUrl("/settings")}`,
    });
    sent++;
  }
  await cleanupRateLimits();
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.emailToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
  return NextResponse.json({ ok: true, checked: users.length, sent });
}
