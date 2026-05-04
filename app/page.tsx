import { getServerSession } from "next-auth";

import { SignInButton, SignOutButton } from "@/app/components/auth-buttons";
import { ShoppingListApp } from "@/app/components/shopping-list-app";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user?.email);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Budgetly
          </h1>
          <p className="text-sm text-zinc-400">
            Manage budgets, track expenses and income, and keep your finances in sync.
          </p>
        </div>
        {isAuthenticated ? <SignOutButton /> : <SignInButton />}
      </header>

      {!isAuthenticated && (
        <main className="flex flex-1 items-center justify-center">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-zinc-900/70 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur">
            <h2 className="text-xl font-semibold text-zinc-100">
              Sign in to manage your finances
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Your budgets and entries are private to your account and stored in a
              Vercel-managed Postgres database.
            </p>
            <div className="mt-5 flex justify-center">
              <SignInButton />
            </div>
          </div>
        </main>
      )}

      {isAuthenticated && (
        <main className="flex-1">
          <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300 backdrop-blur">
            Signed in as{" "}
            <span className="font-semibold text-zinc-100">
              {session?.user?.email}
            </span>
          </div>
          <ShoppingListApp />
        </main>
      )}
    </div>
  );
}
