import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { EntryCurrency } from "@/lib/currency";
import { getDb } from "@/lib/db";
import { shoppingItems, shoppingLists } from "@/lib/db/schema";

export type ListType = "budget" | "todo";

export type ShoppingItemRecord = {
  id: string;
  listId: string;
  name: string;
  quantity: string;
  sortOrder: number;
  unitPrice: string | null;
  currency: EntryCurrency;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingListRecord = {
  id: string;
  name: string;
  type: ListType;
  createdAt: string;
  updatedAt: string;
  items: ShoppingItemRecord[];
};

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function mapItemRow(row: typeof shoppingItems.$inferSelect): ShoppingItemRecord {
  return {
    id: row.id,
    listId: row.listId,
    name: row.name,
    quantity: String(row.quantity),
    sortOrder: row.sortOrder,
    unitPrice: row.unitPrice != null ? String(row.unitPrice) : null,
    currency: row.currency as EntryCurrency,
    completed: row.completed,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export async function getListsForUser(userId: string): Promise<ShoppingListRecord[]> {
  const db = getDb();

  const listRows = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.userId, userId))
    .orderBy(desc(shoppingLists.updatedAt), desc(shoppingLists.createdAt));

  if (listRows.length === 0) {
    return [];
  }

  const listIds = listRows.map((list) => list.id);
  const itemRows = await db
    .select()
    .from(shoppingItems)
    .where(inArray(shoppingItems.listId, listIds))
    .orderBy(asc(shoppingItems.sortOrder), desc(shoppingItems.createdAt));

  const itemsByList = new Map<string, ShoppingItemRecord[]>();
  for (const item of itemRows) {
    const entry = mapItemRow(item);
    const listItems = itemsByList.get(item.listId) ?? [];
    listItems.push(entry);
    itemsByList.set(item.listId, listItems);
  }

  return listRows.map((list) => ({
    id: list.id,
    name: list.name,
    type: list.type as ListType,
    createdAt: toIsoString(list.createdAt),
    updatedAt: toIsoString(list.updatedAt),
    items: itemsByList.get(list.id) ?? [],
  }));
}

export async function createList(
  userId: string,
  name: string,
  type: ListType,
): Promise<Omit<ShoppingListRecord, "items">> {
  const db = getDb();
  const now = new Date();

  const [list] = await db
    .insert(shoppingLists)
    .values({
      userId,
      name,
      type,
      updatedAt: now,
    })
    .returning();

  return {
    id: list.id,
    name: list.name,
    type: list.type as ListType,
    createdAt: toIsoString(list.createdAt),
    updatedAt: toIsoString(list.updatedAt),
  };
}

export async function renameList(
  userId: string,
  listId: string,
  name: string,
): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(shoppingLists)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, userId)))
    .returning({ id: shoppingLists.id });

  return updated.length > 0;
}

export async function deleteList(userId: string, listId: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, userId)))
    .returning({ id: shoppingLists.id });

  return deleted.length > 0;
}

async function userOwnsList(userId: string, listId: string): Promise<boolean> {
  const db = getDb();
  const [list] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, userId)))
    .limit(1);

  return Boolean(list);
}

export async function createItem(
  userId: string,
  input: {
    listId: string;
    name: string;
    quantity: string;
    unitPrice?: string;
    currency?: EntryCurrency;
    completed?: boolean;
  },
): Promise<ShoppingItemRecord | null> {
  const db = getDb();
  const ownsList = await userOwnsList(userId, input.listId);
  if (!ownsList) {
    return null;
  }

  const now = new Date();
  const [maxSortOrderRow] = await db
    .select({
      maxSortOrder: sql<number>`coalesce(max(${shoppingItems.sortOrder}), -1)`,
    })
    .from(shoppingItems)
    .where(eq(shoppingItems.listId, input.listId));
  const nextSortOrder = Number(maxSortOrderRow?.maxSortOrder ?? -1) + 1;

  const [item] = await db
    .insert(shoppingItems)
    .values({
      listId: input.listId,
      name: input.name,
      quantity: input.quantity,
      sortOrder: nextSortOrder,
      currency: input.currency ?? "USD",
      unitPrice: input.unitPrice ?? null,
      completed: input.completed ?? false,
      updatedAt: now,
    })
    .returning();

  await db
    .update(shoppingLists)
    .set({ updatedAt: now })
    .where(eq(shoppingLists.id, input.listId));

  return mapItemRow(item);
}

export async function updateItem(
  userId: string,
  itemId: string,
  input: {
    name: string;
    quantity: string;
    unitPrice?: string;
    currency: EntryCurrency;
    completed: boolean;
  },
): Promise<ShoppingItemRecord | null> {
  const db = getDb();
  const [ownedItem] = await db
    .select({
      id: shoppingItems.id,
      listId: shoppingItems.listId,
    })
    .from(shoppingItems)
    .innerJoin(shoppingLists, eq(shoppingItems.listId, shoppingLists.id))
    .where(and(eq(shoppingItems.id, itemId), eq(shoppingLists.userId, userId)))
    .limit(1);

  if (!ownedItem) {
    return null;
  }

  const now = new Date();
  const [updatedItem] = await db
    .update(shoppingItems)
    .set({
      name: input.name,
      quantity: input.quantity,
      currency: input.currency,
      unitPrice: input.unitPrice ?? null,
      completed: input.completed,
      updatedAt: now,
    })
    .where(eq(shoppingItems.id, itemId))
    .returning();

  await db
    .update(shoppingLists)
    .set({ updatedAt: now })
    .where(eq(shoppingLists.id, ownedItem.listId));

  return mapItemRow(updatedItem);
}

export async function reorderItems(
  userId: string,
  listId: string,
  itemIds: string[],
): Promise<boolean> {
  const db = getDb();

  const ownedItems = await db
    .select({ id: shoppingItems.id })
    .from(shoppingItems)
    .innerJoin(shoppingLists, eq(shoppingItems.listId, shoppingLists.id))
    .where(and(eq(shoppingItems.listId, listId), eq(shoppingLists.userId, userId)));

  if (ownedItems.length === 0) {
    return false;
  }

  if (itemIds.length !== ownedItems.length) {
    return false;
  }

  const ownedItemIds = new Set(ownedItems.map((item) => item.id));
  const providedItemIds = new Set(itemIds);

  if (ownedItemIds.size !== providedItemIds.size) {
    return false;
  }

  for (const itemId of itemIds) {
    if (!ownedItemIds.has(itemId)) {
      return false;
    }
  }

  const now = new Date();
  for (const [index, itemId] of itemIds.entries()) {
    await db
      .update(shoppingItems)
      .set({ sortOrder: index, updatedAt: now })
      .where(eq(shoppingItems.id, itemId));
  }

  await db
    .update(shoppingLists)
    .set({ updatedAt: now })
    .where(eq(shoppingLists.id, listId));

  return true;
}

export async function deleteItem(userId: string, itemId: string): Promise<boolean> {
  const db = getDb();
  const [ownedItem] = await db
    .select({
      id: shoppingItems.id,
      listId: shoppingItems.listId,
    })
    .from(shoppingItems)
    .innerJoin(shoppingLists, eq(shoppingItems.listId, shoppingLists.id))
    .where(and(eq(shoppingItems.id, itemId), eq(shoppingLists.userId, userId)))
    .limit(1);

  if (!ownedItem) {
    return false;
  }

  const deletedRows = await db
    .delete(shoppingItems)
    .where(eq(shoppingItems.id, itemId))
    .returning({ id: shoppingItems.id });

  if (deletedRows.length > 0) {
    await db
      .update(shoppingLists)
      .set({ updatedAt: new Date() })
      .where(eq(shoppingLists.id, ownedItem.listId));
  }

  return deletedRows.length > 0;
}
