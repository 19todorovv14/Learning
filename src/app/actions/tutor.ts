"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export async function deleteConversationAction(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id") ?? "");
  await db.aIConversation.deleteMany({ where: { id, userId: user.id } });
  redirect("/tutor");
}
