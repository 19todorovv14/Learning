// Употреба: npm run user:admin -- имейл@пример.bg "СилнаПарола123" "Име"
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { createPrismaClient } from "../src/lib/prisma-factory";

async function main() {
  const [email, password, name = "Администратор"] = process.argv.slice(2);
  if (!email || !password || password.length < 10) {
    console.error('Употреба: npm run user:admin -- email "парола (поне 10 символа)" "Име"');
    process.exit(1);
  }
  const db = createPrismaClient();
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
  const user = await db.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      displayName: name,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
      preferences: { create: {} },
      profile: { create: { onboardingCompletedAt: new Date(), learnerType: "OTHER" } },
    },
    update: { role: "ADMIN", passwordHash },
  });
  console.log(`✔ ${user.email} е администратор.`);
  await db.$disconnect();
}
main();
