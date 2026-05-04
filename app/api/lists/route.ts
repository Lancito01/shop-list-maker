import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { createList, getListsForUser } from "@/lib/data/shopping";
import { createListSchema } from "@/lib/validation";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  try {
    const lists = await getListsForUser(user.id);
    return NextResponse.json({ lists });
  } catch (error) {
    console.error("Failed to fetch shopping lists", error);
    return NextResponse.json(
      { error: "Unable to fetch shopping lists." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const parsed = createListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid list payload." },
        { status: 400 },
      );
    }

    const list = await createList(user.id, parsed.data.name, parsed.data.type);
    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    console.error("Failed to create shopping list", error);
    return NextResponse.json(
      { error: "Unable to create shopping list." },
      { status: 500 },
    );
  }
}
