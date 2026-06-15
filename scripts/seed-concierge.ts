/**
 * Seed (or update) the concierge's User + BotIdentity in the app database.
 *
 *   npx tsx scripts/seed-concierge.ts [email]
 *
 * Prints the email to set as NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL, which lights
 * up the "AI Assistant" tile in the secure-chat UI. Idempotent.
 */
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.argv[2] ?? "concierge@quirinschlegel.com").trim().toLowerCase();

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "AI Concierge", emailVerified: true },
    create: { id: randomUUID(), email, name: "AI Concierge", emailVerified: true },
    select: { id: true, email: true },
  });

  const bot = await prisma.botIdentity.upsert({
    where: { userId: user.id },
    update: { displayName: "AI Concierge", relayEnabled: true },
    create: { userId: user.id, displayName: "AI Concierge", relayEnabled: true },
    select: { id: true },
  });

  console.log(`[seed] concierge user:   ${user.id} (${user.email})`);
  console.log(`[seed] concierge bot id: ${bot.id}`);
  console.log(`\nSet this env var to activate the AI Assistant tile:`);
  console.log(`  NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL=${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
