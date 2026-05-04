import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ensureUserForSession, type AppUser } from "@/lib/data/users";

export async function getAuthenticatedUser(): Promise<AppUser | null> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const email = sessionUser?.email?.trim().toLowerCase();

  if (!sessionUser || !email) {
    return null;
  }

  return ensureUserForSession({
    email,
    name: sessionUser.name ?? null,
    image: sessionUser.image ?? null,
  });
}
