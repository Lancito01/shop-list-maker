import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { deleteList } from "@/lib/data/shopping";
import { idParamSchema } from "@/lib/validation";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  const { listId } = await context.params;
  const parsedListId = idParamSchema.safeParse(listId);
  if (!parsedListId.success) {
    return NextResponse.json({ error: "Invalid list id." }, { status: 400 });
  }

  try {
    const removed = await deleteList(user.id, parsedListId.data);
    if (!removed) {
      return NextResponse.json({ error: "List not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete shopping list", error);
    return NextResponse.json(
      { error: "Unable to delete shopping list." },
      { status: 500 },
    );
  }
}
