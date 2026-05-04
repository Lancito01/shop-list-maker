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

type EditDraft = {
  itemId: string;
  name: string;
  quantity: string;
  absPrice: string;
  isNeg: boolean;
};

const defaultNewItem = {
  name: "",
  quantity: "1",
  unitPrice: "",
};

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 3.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ShoppingListApp() {
  const [lists, setLists] = useState<ShoppingListRecord[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newItem, setNewItem] = useState(defaultNewItem);
  const [newItemCustomAmount, setNewItemCustomAmount] = useState(false);
  const [newItemPriceNegative, setNewItemPriceNegative] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [creatingList, setCreatingList] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItems, setDeletingItems] = useState<PendingMap>({});
  const [deletingLists, setDeletingLists] = useState<PendingMap>({});
  const [editingDraft, setEditingDraft] = useState<EditDraft | null>(null);
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
      setEditingDraft((current) => {
        if (!current) {
          return current;
        }

        const stillExists = payload.lists.some((list) =>
          list.items.some((item) => item.id === current.itemId),
        );
        return stillExists ? current : null;
      });
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

  const hasEstimatedItems = useMemo(
    () => selectedList?.items.some((item) => !item.unitPrice) ?? false,
    [selectedList],
  );

  function startEditing(item: ShoppingItemRecord) {
    const isNeg = Boolean(item.unitPrice && item.unitPrice.startsWith("-"));
    setEditingDraft({
      itemId: item.id,
      name: item.name,
      quantity: item.quantity,
      absPrice: isNeg ? (item.unitPrice?.slice(1) ?? "") : (item.unitPrice ?? ""),
      isNeg,
    });
  }

  function cancelEditing() {
    setEditingDraft(null);
  }

  async function saveEditedItem() {
    if (!editingDraft) return;

    const finalPrice =
      editingDraft.absPrice.trim() === ""
        ? ""
        : editingDraft.isNeg
          ? `-${editingDraft.absPrice.trim()}`
          : editingDraft.absPrice.trim();

    setSavingItem(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/items/${editingDraft.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingDraft.name,
          quantity: editingDraft.quantity,
          unitPrice: finalPrice,
        }),
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save item.");
      }

      setEditingDraft(null);
      await loadLists();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save item.";
      setErrorMessage(message);
    } finally {
      setSavingItem(false);
    }
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

    const normalizedUnitPrice = newItem.unitPrice.trim().replace(/^-+/, "");
    const finalPrice =
      newItemPriceNegative && normalizedUnitPrice
        ? `-${normalizedUnitPrice}`
        : normalizedUnitPrice;

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listId: selectedListId,
          name: newItem.name,
          quantity: newItemCustomAmount ? newItem.quantity : "1",
          unitPrice: finalPrice,
        }),
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add item.");
      }

      setNewItem(defaultNewItem);
      setNewItemCustomAmount(false);
      setNewItemPriceNegative(false);
      await loadLists();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add item.";
      setErrorMessage(message);
    } finally {
      setCreatingItem(false);
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
                  onClick={() => {
                    setSelectedListId(list.id);
                    setEditingDraft(null);
                  }}
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
            {/* Budget header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-zinc-100">{selectedList.name}</h2>
              <p
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                  hasEstimatedItems
                    ? "border-amber-400/50 bg-amber-500/10 text-amber-200"
                    : listTotal < 0
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                      : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {listTotal < 0
                  ? `Net Received: ${hasEstimatedItems ? "~" : ""}${formatCurrency(Math.abs(listTotal))}`
                  : `${hasEstimatedItems ? "Est. " : ""}Total: ${formatCurrency(listTotal)}`}
                {hasEstimatedItems && (
                  <span className="ml-1.5 text-xs opacity-70">(some prices TBD)</span>
                )}
              </p>
            </div>

            {/* Add item form */}
            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 space-y-2">
              {/* Row 1: name + custom amount toggle */}
              <div className="flex items-center gap-3">
                <input
                  value={newItem.name}
                  onChange={(event) =>
                    setNewItem((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Entry name"
                  className="flex-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
                />
                <label className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={newItemCustomAmount}
                    onChange={(event) => {
                      setNewItemCustomAmount(event.target.checked);
                      if (!event.target.checked) {
                        setNewItem((current) => ({ ...current, quantity: "1" }));
                      }
                    }}
                    className="rounded accent-cyan-400"
                  />
                  Custom amount
                </label>
              </div>

              {/* Row 2: optional qty, sign toggle + price, add button */}
              <div className="flex flex-wrap items-center gap-2">
                {newItemCustomAmount && (
                  <input
                    value={newItem.quantity}
                    onChange={(event) =>
                      setNewItem((current) => ({ ...current, quantity: event.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="Qty"
                    className="w-20 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
                  />
                )}

                <div className="flex flex-1 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewItemPriceNegative((n) => !n)}
                    title={newItemPriceNegative ? "Currently: income (−). Click to switch to expense (+)." : "Currently: expense (+). Click to switch to income (−)."}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                      newItemPriceNegative
                        ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                        : "border-white/15 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {newItemPriceNegative ? "−" : "+"}
                  </button>
                  <input
                    value={newItem.unitPrice}
                    onChange={(event) =>
                      setNewItem((current) => ({ ...current, unitPrice: event.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="Price (optional)"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void addItem()}
                  disabled={creatingItem}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add Entry
                </button>
              </div>
            </div>

            {/* Items list */}
            <div className="space-y-1.5">
              {selectedList.items.length === 0 && (
                <p className="py-4 text-center text-sm text-zinc-400">
                  No entries yet. Add your first entry above.
                </p>
              )}
              {selectedList.items.length > 0 && (
                <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_11rem] items-center gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <span>Entry</span>
                  <span className="text-right">Qty x Price</span>
                  <span className="text-right">Subtotal</span>
                  <span className="text-right">Actions</span>
                </div>
              )}

              {selectedList.items.map((item) => {
                const isNeg = Boolean(item.unitPrice && item.unitPrice.startsWith("-"));
                const isTbd = !item.unitPrice;
                const subtotal = toNumber(item.quantity) * toNumber(item.unitPrice);
                const isDeleting = Boolean(deletingItems[item.id]);
                const isThisEditing = editingDraft?.itemId === item.id;

                // Row theme based on value type
                const rowTheme = isTbd
                  ? "border-amber-400/30 bg-amber-500/5"
                  : isNeg
                    ? "border-emerald-400/40 bg-emerald-500/15"
                    : "border-white/10 bg-zinc-950/40";

                const subtotalColor = isTbd
                  ? "text-amber-300"
                  : isNeg
                    ? "text-emerald-300"
                    : "text-zinc-100";

                if (isThisEditing && editingDraft) {
                  // ── EDIT MODE ──────────────────────────────────────────────
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 space-y-2 ${rowTheme}`}
                    >
                      {/* Name input */}
                      <input
                        value={editingDraft.name}
                        onChange={(e) =>
                          setEditingDraft((d) => d ? { ...d, name: e.target.value } : d)
                        }
                        placeholder="Entry name"
                        className="w-full rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
                      />

                      {/* Controls row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Quantity */}
                        <input
                          value={editingDraft.quantity}
                          onChange={(e) =>
                            setEditingDraft((d) => d ? { ...d, quantity: e.target.value } : d)
                          }
                          inputMode="decimal"
                          placeholder="Qty"
                          className="w-16 rounded-lg border border-white/10 bg-zinc-950/80 px-2.5 py-2 text-sm text-zinc-100 focus:border-cyan-400/60 focus:outline-none"
                        />

                        {/* Sign toggle + price */}
                        <div className="flex flex-1 items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingDraft((d) => d ? { ...d, isNeg: !d.isNeg } : d)
                            }
                            title={
                              editingDraft.isNeg
                                ? "Currently: income (−). Click to switch to expense (+)."
                                : "Currently: expense (+). Click to switch to income (−)."
                            }
                            className={`rounded-lg border px-2.5 py-2 text-sm font-bold transition ${
                              editingDraft.isNeg
                                ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                                : "border-white/15 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700"
                            }`}
                          >
                            {editingDraft.isNeg ? "−" : "+"}
                          </button>
                          <input
                            value={editingDraft.absPrice}
                            onChange={(e) =>
                              setEditingDraft((d) => d ? { ...d, absPrice: e.target.value } : d)
                            }
                            inputMode="decimal"
                            placeholder="Price (TBD)"
                            className="min-w-0 flex-1 rounded-lg border bg-zinc-950/80 px-2.5 py-2 text-sm text-zinc-100 focus:outline-none border-white/10 focus:border-cyan-400/60"
                          />
                        </div>

                        {/* Save / Cancel */}
                        <div className="ml-auto flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEditedItem()}
                            disabled={savingItem}
                            className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingItem ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={savingItem}
                            className="rounded-lg border border-white/20 bg-zinc-800/70 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── VIEW MODE ───────────────────────────────────────────────
                const qtyNum = toNumber(item.quantity);
                const priceLabel = isTbd
                  ? "TBD"
                  : formatCurrency(Math.abs(toNumber(item.unitPrice)));

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 md:grid md:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_11rem] md:gap-3 ${rowTheme}`}
                  >
                    {/* Entry name */}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100 md:flex-none">
                      {item.name || <span className="italic text-zinc-500">Unnamed entry</span>}
                    </span>

                    {/* Qty × unit price — hidden on mobile */}
                    <span className="hidden whitespace-nowrap text-right text-xs text-zinc-400 tabular-nums md:block">
                      {qtyNum !== 1
                        ? `${item.quantity} × ${priceLabel}`
                        : priceLabel}
                    </span>

                    {/* Subtotal */}
                    <span
                      className={`whitespace-nowrap text-sm font-semibold tabular-nums md:text-right ${subtotalColor}`}
                    >
                      {isTbd ? "TBD" : formatCurrency(subtotal)}
                    </span>

                    {/* Action buttons */}
                    <div className="ml-auto flex shrink-0 items-center justify-end gap-1 md:ml-0">
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        disabled={isDeleting}
                        title="Edit entry"
                        aria-label="Edit entry"
                        className="flex h-8 w-8 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-zinc-800/60 px-0 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 md:h-auto md:w-[4.75rem] md:px-2.5"
                      >
                        <PencilIcon />
                        <span className="hidden md:inline">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeItem(item.id)}
                        disabled={isDeleting}
                        title="Delete entry"
                        aria-label="Delete entry"
                        className="flex h-8 w-8 items-center justify-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-0 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60 md:h-auto md:w-[5.75rem] md:px-2.5"
                      >
                        <TrashIcon />
                        <span className="hidden md:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
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


