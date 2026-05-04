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
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Shopping List Maker</h1>
          <p className="text-sm text-zinc-600">
            Build lists, track amounts and prices, and keep totals in sync.
          </p>
        </div>
        {isAuthenticated ? <SignOutButton /> : <SignInButton />}
      </header>

      {!isAuthenticated && (
        <main className="flex flex-1 items-center justify-center">
          <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-zinc-900">
              Sign in to manage your shopping lists
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Your data is private to your account and stored in a Vercel-managed
              Postgres database.
            </p>
            <div className="mt-5 flex justify-center">
              <SignInButton />
            </div>
          </div>
        </main>
      )}

      {isAuthenticated && (
        <main className="flex-1">
          <div className="mb-4 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            Signed in as{" "}
            <span className="font-semibold text-zinc-900">
              {session?.user?.email}
            </span>
          </div>
          <ShoppingListApp />
        </main>
      )}
    </div>
  );
}
