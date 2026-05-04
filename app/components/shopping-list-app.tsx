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
        throw new Error(payload.error ?? "Unable to load budgets.");
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
        error instanceof Error ? error.message : "Unable to load budgets.";
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
      setErrorMessage("Budget name cannot be empty.");
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
    if (!window.confirm("Delete this budget and all its entries?")) {
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
      setErrorMessage("Select a budget before adding an entry.");
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
    if (!window.confirm("Remove this entry from the budget?")) {
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
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur">
        <h2 className="text-lg font-semibold text-zinc-100">Your Budgets</h2>

        <div className="mt-3 flex gap-2">
          <input
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            placeholder="New budget name"
            className="w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void createList()}
            disabled={creatingList}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loadingLists && <p className="text-sm text-zinc-400">Loading lists...</p>}
          {!loadingLists && lists.length === 0 && (
            <p className="text-sm text-zinc-400">Create your first budget.</p>
          )}
          {lists.map((list) => {
            const active = list.id === selectedListId;
            return (
              <div
                key={list.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  active
                    ? "border-cyan-400/50 bg-zinc-800/80 shadow-lg shadow-cyan-950/30"
                    : "border-white/10 bg-zinc-900/70 hover:bg-zinc-800/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  className="truncate text-left text-sm font-medium text-zinc-100"
                >
                  {list.name}
                </button>
                <button
                  type="button"
                  onClick={() => void removeList(list.id)}
                  disabled={deletingLists[list.id]}
                  className="rounded px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur">
        {!selectedList && (
          <p className="text-sm text-zinc-400">
            Select or create a budget to start adding entries.
          </p>
        )}

        {selectedList && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-zinc-100">{selectedList.name}</h2>
              <p className={`rounded-full border px-3 py-1 text-sm font-semibold ${listTotal < 0 ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"}`}>
                {listTotal < 0 ? `Net Received: ${formatCurrency(Math.abs(listTotal))}` : `Total: ${formatCurrency(listTotal)}`}
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_0.7fr_auto]">
              <input
                value={newItem.name}
                onChange={(event) =>
                  setNewItem((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Entry name"
                className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
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
                className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
              />
              <input
                value={newItem.unitPrice}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    unitPrice: event.target.value,
                  }))
                }
                placeholder="Unit price (- for income)"
                className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void addItem()}
                disabled={creatingItem}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add Entry
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-zinc-400">
                    <th className="py-2">Entry</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Unit Price</th>
                    <th className="py-2">Subtotal</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedList.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-zinc-400">
                        No entries yet. Add your first entry above.
                      </td>
                    </tr>
                  )}

                  {selectedList.items.map((item) => {
                    const subtotal = toNumber(item.quantity) * toNumber(item.unitPrice);
                    const isSaving = Boolean(savingItems[item.id]);
                    const isDeleting = Boolean(deletingItems[item.id]);
                    const isIncome = toNumber(item.unitPrice) < 0;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b ${isIncome ? "border-emerald-400/20 bg-emerald-500/5" : "border-white/5"}`}
                      >
                        <td className="py-2 pr-3">
                          <input
                            value={item.name}
                            onChange={(event) =>
                              updateItemInLocalState(item.id, (current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-white/10 bg-zinc-950/80 px-2 py-1 text-zinc-100 focus:border-cyan-400/60 focus:outline-none"
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
                            className="w-full rounded-lg border border-white/10 bg-zinc-950/80 px-2 py-1 text-zinc-100 focus:border-cyan-400/60 focus:outline-none"
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
                            className="w-full rounded-lg border border-white/10 bg-zinc-950/80 px-2 py-1 text-zinc-100 focus:border-cyan-400/60 focus:outline-none"
                          />
                        </td>
                        <td className={`py-2 pr-3 font-medium ${isIncome ? "text-emerald-300" : "text-zinc-100"}`}>
                          {formatCurrency(subtotal)}
                        </td>
                        <td className="py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void saveItem(item)}
                              disabled={isSaving}
                              className="rounded-lg border border-white/20 bg-zinc-800/70 px-2 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeItem(item.id)}
                              disabled={isDeleting}
                              className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
          <p className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {errorMessage}
          </p>
        )}
      </section>
    </div>
  );
}
