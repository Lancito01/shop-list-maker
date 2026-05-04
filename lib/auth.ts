import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { upsertGoogleUser } from "@/lib/data/users";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return false;
      }

      const email = user.email?.trim().toLowerCase();
      if (!email) {
        return false;
      }

      try {
        await upsertGoogleUser({
          email,
          name: user.name ?? null,
          imageUrl: user.image ?? null,
          googleSub:
            typeof profile?.sub === "string"
              ? profile.sub
              : account.providerAccountId ?? null,
        });
        return true;
      } catch (error) {
        console.error("Unable to persist signed-in user", error);
        return false;
      }
    },
  },
};
