import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { reorderItems } from "@/lib/data/shopping";
import { reorderItemsSchema } from "@/lib/validation";

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
    const parsedBody = reorderItemsSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid reorder payload." },
        { status: 400 },
      );
    }

    const reordered = await reorderItems(
      user.id,
      parsedBody.data.listId,
      parsedBody.data.itemIds,
    );
    if (!reordered) {
      return NextResponse.json(
        { error: "Unable to reorder entries for this list." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to reorder shopping items", error);
    return NextResponse.json(
      { error: "Unable to reorder shopping items." },
      { status: 500 },
    );
  }
}
