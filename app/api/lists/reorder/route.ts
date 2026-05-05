import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { reorderLists } from "@/lib/data/shopping";
import { reorderListsSchema } from "@/lib/validation";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const parsedBody = reorderListsSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid reorder payload." },
        { status: 400 },
      );
    }

    const reordered = await reorderLists(user.id, parsedBody.data.listIds);
    if (!reordered) {
      return NextResponse.json(
        { error: "Unable to reorder lists for this account." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to reorder shopping lists", error);
    return NextResponse.json(
      { error: "Unable to reorder shopping lists." },
      { status: 500 },
    );
  }
}
