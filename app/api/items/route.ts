import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { createItem } from "@/lib/data/shopping";
import { createItemSchema } from "@/lib/validation";

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
    const parsed = createItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid item payload." },
        { status: 400 },
      );
    }

    const item = await createItem(user.id, parsed.data);
    if (!item) {
      return NextResponse.json(
        { error: "List not found for this user." },
        { status: 404 },
      );
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Failed to create shopping item", error);
    return NextResponse.json(
      { error: "Unable to create shopping item." },
      { status: 500 },
    );
  }
}
