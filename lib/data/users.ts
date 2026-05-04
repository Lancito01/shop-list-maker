import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

type UpsertGoogleUserInput = {
  email: string;
  name: string | null;
  imageUrl: string | null;
  googleSub: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAppUser(row: typeof users.$inferSelect): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    imageUrl: row.imageUrl,
  };
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return user ? toAppUser(user) : null;
}

export async function upsertGoogleUser(
  input: UpsertGoogleUserInput,
): Promise<AppUser> {
  const db = getDb();
  const normalizedEmail = normalizeEmail(input.email);
  const now = new Date();

  const updateSet = {
    name: input.name,
    imageUrl: input.imageUrl,
    updatedAt: now,
    ...(input.googleSub ? { googleSub: input.googleSub } : {}),
  };

  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name: input.name,
      imageUrl: input.imageUrl,
      googleSub: input.googleSub,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: updateSet,
    })
    .returning();

  return toAppUser(user);
}

export async function ensureUserForSession(input: {
  email: string;
  name: string | null;
  image: string | null;
}): Promise<AppUser> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    return existing;
  }

  return upsertGoogleUser({
    email: input.email,
    name: input.name,
    imageUrl: input.image,
    googleSub: null,
  });
}
