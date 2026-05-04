import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { deleteItem, updateItem } from "@/lib/data/shopping";
import { idParamSchema, updateItemSchema } from "@/lib/validation";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  const { itemId } = await context.params;
  const parsedItemId = idParamSchema.safeParse(itemId);
  if (!parsedItemId.success) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsedBody = updateItemSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid item payload." },
        { status: 400 },
      );
    }

    const item = await updateItem(user.id, parsedItemId.data, parsedBody.data);
    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Failed to update shopping item", error);
    return NextResponse.json(
      { error: "Unable to update shopping item." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  const { itemId } = await context.params;
  const parsedItemId = idParamSchema.safeParse(itemId);
  if (!parsedItemId.success) {
    return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
  }

  try {
    const removed = await deleteItem(user.id, parsedItemId.data);
    if (!removed) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete shopping item", error);
    return NextResponse.json(
      { error: "Unable to delete shopping item." },
      { status: 500 },
    );
  }
}
