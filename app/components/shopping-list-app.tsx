"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatCurrency, toNumber } from "@/lib/currency";
import type {
  ShoppingItemRecord,
  ShoppingListRecord,
} from "@/lib/data/shopping";

type ShoppingListResponse = {
  lists: ShoppingListRecord[];
  error?: string;
};

type MutationErrorResponse = {
  error?: string;
};

type PendingMap = Record<string, boolean>;

const defaultNewItem = {
  name: "",
  quantity: "1",
  unitPrice: "0.00",
};

export function ShoppingListApp() {
  const [lists, setLists] = useState<ShoppingListRecord[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newItem, setNewItem] = useState(defaultNewItem);
  const [loadingLists, setLoadingLists] = useState(true);
  const [creatingList, setCreatingList] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [savingItems, setSavingItems] = useState<PendingMap>({});
  const [deletingItems, setDeletingItems] = useState<PendingMap>({});
  const [deletingLists, setDeletingLists] = useState<PendingMap>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/lists", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as ShoppingListResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load shopping lists.");
      }

      setLists(payload.lists);
      setSelectedListId((current) => {
        if (current && payload.lists.some((list) => list.id === current)) {
          return current;
        }

        return payload.lists[0]?.id ?? null;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load shopping lists.";
      setErrorMessage(message);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLists();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadLists]);

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId],
  );

  const listTotal = useMemo(() => {
    if (!selectedList) {
      return 0;
    }

    return selectedList.items.reduce(
      (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice),
      0,
    );
  }, [selectedList]);

  function updateItemInLocalState(
    itemId: string,
    updater: (item: ShoppingItemRecord) => ShoppingItemRecord,
  ) {
    setLists((currentLists) =>
      currentLists.map((list) => {
        if (list.id !== selectedListId) {
          return list;
        }

        return {
          ...list,
          items: list.items.map((item) => (item.id === itemId ? updater(item) : item)),
        };
      }),
    );
  }

  async function createList() {
    const trimmedName = newListName.trim();
    if (!trimmedName) {
      setErrorMessage("List name cannot be empty.");
      return;
    }

    setCreatingList(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      });
      const payload = (await response.json()) as {
        list?: { id: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create list.");
      }

      if (!payload.list?.id) {
        throw new Error("Server returned an invalid list payload.");
      }

      setNewListName("");
      await loadLists();
      setSelectedListId(payload.list.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create list.";
      setErrorMessage(message);
    } finally {
      setCreatingList(false);
    }
  }

  async function removeList(listId: string) {
    if (!window.confirm("Delete this list and all its items?")) {
      return;
    }

    setDeletingLists((current) => ({ ...current, [listId]: true }));
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete list.");
      }

      await loadLists();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete list.";
      setErrorMessage(message);
    } finally {
      setDeletingLists((current) => ({ ...current, [listId]: false }));
    }
  }

  async function addItem() {
    if (!selectedListId) {
      setErrorMessage("Select a list before adding an item.");
      return;
    }

    setCreatingItem(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listId: selectedListId,
          name: newItem.name,
          quantity: newItem.quantity,
          unitPrice: newItem.unitPrice,
        }),
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add item.");
      }

      setNewItem(defaultNewItem);
      await loadLists();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add item.";
      setErrorMessage(message);
    } finally {
      setCreatingItem(false);
    }
  }

  async function saveItem(item: ShoppingItemRecord) {
    setSavingItems((current) => ({ ...current, [item.id]: true }));
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }),
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save item.");
      }

      await loadLists();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save item.";
      setErrorMessage(message);
    } finally {
      setSavingItems((current) => ({ ...current, [item.id]: false }));
    }
  }

  async function removeItem(itemId: string) {
    if (!window.confirm("Remove this item from the list?")) {
      return;
    }

    setDeletingItems((current) => ({ ...current, [itemId]: true }));
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to remove item.");
      }

      await loadLists();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to remove item.";
      setErrorMessage(message);
    } finally {
      setDeletingItems((current) => ({ ...current, [itemId]: false }));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Your Lists</h2>

        <div className="mt-3 flex gap-2">
          <input
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            placeholder="New list name"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void createList()}
            disabled={creatingList}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loadingLists && <p className="text-sm text-zinc-500">Loading lists...</p>}
          {!loadingLists && lists.length === 0 && (
            <p className="text-sm text-zinc-500">Create your first shopping list.</p>
          )}
          {lists.map((list) => {
            const active = list.id === selectedListId;
            return (
              <div
                key={list.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  active
                    ? "border-zinc-900 bg-zinc-100"
                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  className="truncate text-left text-sm font-medium text-zinc-900"
                >
                  {list.name}
                </button>
                <button
                  type="button"
                  onClick={() => void removeList(list.id)}
                  disabled={deletingLists[list.id]}
                  className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        {!selectedList && (
          <p className="text-sm text-zinc-500">
            Select or create a list to start adding items.
          </p>
        )}

        {selectedList && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-zinc-900">{selectedList.name}</h2>
              <p className="text-sm font-semibold text-zinc-700">
                Total: {formatCurrency(listTotal)}
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_0.7fr_auto]">
              <input
                value={newItem.name}
                onChange={(event) =>
                  setNewItem((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Item name"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
              />
              <input
                value={newItem.quantity}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                inputMode="decimal"
                placeholder="Qty"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
              />
              <input
                value={newItem.unitPrice}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    unitPrice: event.target.value,
                  }))
                }
                inputMode="decimal"
                placeholder="Unit price"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void addItem()}
                disabled={creatingItem}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600">
                    <th className="py-2">Item</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Unit Price</th>
                    <th className="py-2">Subtotal</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedList.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-zinc-500">
                        No items yet. Add your first item above.
                      </td>
                    </tr>
                  )}

                  {selectedList.items.map((item) => {
                    const subtotal = toNumber(item.quantity) * toNumber(item.unitPrice);
                    const isSaving = Boolean(savingItems[item.id]);
                    const isDeleting = Boolean(deletingItems[item.id]);

                    return (
                      <tr key={item.id} className="border-b border-zinc-100">
                        <td className="py-2 pr-3">
                          <input
                            value={item.name}
                            onChange={(event) =>
                              updateItemInLocalState(item.id, (current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-zinc-300 px-2 py-1 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            value={item.quantity}
                            onChange={(event) =>
                              updateItemInLocalState(item.id, (current) => ({
                                ...current,
                                quantity: event.target.value,
                              }))
                            }
                            inputMode="decimal"
                            className="w-full rounded-md border border-zinc-300 px-2 py-1 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateItemInLocalState(item.id, (current) => ({
                                ...current,
                                unitPrice: event.target.value,
                              }))
                            }
                            inputMode="decimal"
                            className="w-full rounded-md border border-zinc-300 px-2 py-1 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3 font-medium text-zinc-800">
                          {formatCurrency(subtotal)}
                        </td>
                        <td className="py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void saveItem(item)}
                              disabled={isSaving}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeItem(item.id)}
                              disabled={isDeleting}
                              className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
      </section>
    </div>
  );
}
