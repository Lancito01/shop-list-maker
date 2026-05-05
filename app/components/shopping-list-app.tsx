"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  displayCurrencies,
  entryCurrencies,
  formatCurrencyParts,
  toNumber,
  type DisplayCurrency,
  type EntryCurrency,
} from "@/lib/currency";
import type {
  ListType,
  ShoppingItemRecord,
  ShoppingListRecord,
} from "@/lib/data/shopping";
import {
  convertAmount,
  type ExchangeRatesSnapshot,
} from "@/lib/exchange-rates";

type ShoppingListResponse = {
  lists: ShoppingListRecord[];
  error?: string;
};

type MutationErrorResponse = {
  error?: string;
};

type ExchangeRatesResponse = ExchangeRatesSnapshot & {
  error?: string;
};

type PendingMap = Record<string, boolean>;

type EditDraft = {
  itemId: string;
  name: string;
  quantity: string;
  absPrice: string;
  isNeg: boolean;
  currency: EntryCurrency;
};

type ItemUpdateInput = {
  name: string;
  quantity: string;
  unitPrice?: string;
  currency: EntryCurrency;
  completed?: boolean;
};

const defaultNewItem = {
  name: "",
  quantity: "1",
  unitPrice: "",
  currency: "USD" as EntryCurrency,
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

function DragHandleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm-1 7a1 1 0 100-2 1 1 0 000 2zm8-13a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm-1 7a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  );
}

function RefreshIcon() {
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
        d="M15.312 7.325a.75.75 0 01-1.06-.013 5.25 5.25 0 10.944 5.786.75.75 0 111.38.588A6.75 6.75 0 113.25 10.25V8.5a.75.75 0 011.5 0v2.5a.75.75 0 01-.75.75H1.5a.75.75 0 010-1.5h1.038a8.25 8.25 0 1014.308-4.004.75.75 0 01.013 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FormattedCurrency({
  value,
  currency,
  className,
}: {
  value: number;
  currency: EntryCurrency | DisplayCurrency;
  className?: string;
}) {
  const { number, currency: code } = formatCurrencyParts(value, currency);
  return (
    <span className={className}>
      {number}
      <span className="currency-suffix">${code}</span>
    </span>
  );
}

type SortableRowProps = {
  disabled?: boolean;
  children: (drag: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    isDragging: boolean;
  }) => ReactNode;
};

function SortableRow({ id, disabled, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 0,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

export function ShoppingListApp() {
  const [lists, setLists] = useState<ShoppingListRecord[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<ListType>("budget");
  const [newItem, setNewItem] = useState(defaultNewItem);
  const [newTodoEntryName, setNewTodoEntryName] = useState("");
  const [todoEditItemId, setTodoEditItemId] = useState<string | null>(null);
  const [todoEditName, setTodoEditName] = useState("");
  const [newItemCustomAmount, setNewItemCustomAmount] = useState(false);
  const [newItemPriceNegative, setNewItemPriceNegative] = useState(false);
  const [newItemCompleted, setNewItemCompleted] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [creatingList, setCreatingList] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<PendingMap>({});
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItems, setDeletingItems] = useState<PendingMap>({});
  const [deletingLists, setDeletingLists] = useState<PendingMap>({});
  const [renamingLists, setRenamingLists] = useState<PendingMap>({});
  const [editingDraft, setEditingDraft] = useState<EditDraft | null>(null);
  const [reorderingItems, setReorderingItems] = useState(false);
  const [reorderingLists, setReorderingLists] = useState(false);
  const [refreshingLists, setRefreshingLists] = useState(false);
  const [bulkUpdatingEntries, setBulkUpdatingEntries] = useState(false);
  const [preferredCurrency, setPreferredCurrency] = useState<DisplayCurrency>(() => {
    if (typeof window === "undefined") {
      return "USD";
    }

    const stored = window.localStorage.getItem("preferred-total-currency");
    return stored === "USD" || stored === "ARS" ? stored : "USD";
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesSnapshot | null>(null);
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);
  const [exchangeRatesError, setExchangeRatesError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [entryTallModeById, setEntryTallModeById] = useState<Record<string, boolean>>({});
  const [entryMeasureTick, setEntryMeasureTick] = useState(0);
  const entryTitleRefs = useRef<Record<string, HTMLSpanElement | null>>({});

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
      setTodoEditItemId((current) => {
        if (!current) {
          return current;
        }

        const stillExists = payload.lists.some((list) =>
          list.items.some((item) => item.id === current),
        );
        if (!stillExists) {
          setTodoEditName("");
        }
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

  const loadExchangeRates = useCallback(async () => {
    setExchangeRatesLoading(true);
    setExchangeRatesError(null);

    try {
      const response = await fetch("/api/exchange-rates", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as ExchangeRatesResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load exchange rates.");
      }

      setExchangeRates(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load exchange rates.";
      setExchangeRatesError(message);
    } finally {
      setExchangeRatesLoading(false);
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadExchangeRates();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadExchangeRates]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadExchangeRates();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadExchangeRates]);

  useEffect(() => {
    window.localStorage.setItem("preferred-total-currency", preferredCurrency);
  }, [preferredCurrency]);

  const refreshFromServer = useCallback(async () => {
    setRefreshingLists(true);
    setErrorMessage(null);

    try {
      await Promise.all([loadLists(), loadExchangeRates()]);
    } finally {
      setRefreshingLists(false);
    }
  }, [loadExchangeRates, loadLists]);

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId],
  );

  const listIds = useMemo(() => lists.map((list) => list.id), [lists]);

  const selectedListItemIds = useMemo(
    () => selectedList?.items.map((item) => item.id) ?? [],
    [selectedList],
  );

  const selectedListHasEntries = (selectedList?.items.length ?? 0) > 0;
  const selectedListAllEntriesChecked = useMemo(
    () => Boolean(selectedListHasEntries && selectedList?.items.every((item) => item.completed)),
    [selectedList, selectedListHasEntries],
  );

  const selectedListEntrySignature = useMemo(
    () =>
      selectedList?.items
        .map((item) => `${item.id}:${item.name}`)
        .join("|") ?? "",
    [selectedList],
  );

  const setEntryTitleRef = useCallback((itemId: string, node: HTMLSpanElement | null) => {
    if (node) {
      entryTitleRefs.current[itemId] = node;
      return;
    }

    delete entryTitleRefs.current[itemId];
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setEntryMeasureTick((current) => current + 1);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const itemIds = selectedListItemIds;
    let resetFrameId = 0;
    let measureFrameId = 0;

    // Re-run detection in regular mode before deciding which entries need tall mode.
    resetFrameId = window.requestAnimationFrame(() => {
      setEntryTallModeById({});

      measureFrameId = window.requestAnimationFrame(() => {
        if (itemIds.length === 0) {
          setEntryTallModeById({});
          return;
        }

        const nextTallModeById: Record<string, boolean> = {};
        for (const itemId of itemIds) {
          const titleEl = entryTitleRefs.current[itemId];
          nextTallModeById[itemId] = titleEl
            ? titleEl.scrollWidth > titleEl.clientWidth + 1
            : false;
        }
        setEntryTallModeById(nextTallModeById);
      });
    });

    return () => {
      window.cancelAnimationFrame(resetFrameId);
      window.cancelAnimationFrame(measureFrameId);
    };
  }, [
    selectedListId,
    selectedListItemIds,
    selectedListEntrySignature,
    entryMeasureTick,
    editingDraft?.itemId,
    todoEditItemId,
  ]);

  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );

  const dragDisabled =
    reorderingItems ||
    savingItem ||
    bulkUpdatingEntries ||
    Boolean(editingDraft) ||
    Boolean(todoEditItemId);
  const listDragDisabled = reorderingLists || creatingList || loadingLists || refreshingLists;
  const checkAllEntriesDisabled =
    !selectedListHasEntries ||
    bulkUpdatingEntries ||
    creatingItem ||
    savingItem ||
    reorderingItems ||
    Boolean(editingDraft) ||
    Boolean(todoEditItemId);

  const convertSubtotal = useCallback(
    (subtotal: number, entryCurrency: EntryCurrency): number | null => {
      if (entryCurrency === preferredCurrency) {
        return subtotal;
      }

      if (!exchangeRates) {
        return null;
      }

      return convertAmount(subtotal, entryCurrency, preferredCurrency, exchangeRates);
    },
    [exchangeRates, preferredCurrency],
  );

  const listTotalsById = useMemo(() => {
    const totals = new Map<string, { total: number; unavailable: boolean }>();

    for (const list of lists) {
      if (list.type !== "budget") {
        continue;
      }

      let total = 0;
      let unavailable = false;

      for (const item of list.items) {
        if (!item.unitPrice) {
          continue;
        }

        const subtotal = toNumber(item.quantity) * toNumber(item.unitPrice);
        const converted = convertSubtotal(subtotal, item.currency);
        if (converted == null) {
          unavailable = true;
          continue;
        }

        total += converted;
      }

      totals.set(list.id, { total, unavailable });
    }

    return totals;
  }, [convertSubtotal, lists]);

  const selectedListTotals = useMemo(() => {
    if (!selectedList || selectedList.type !== "budget") {
      return { total: 0, unavailable: false };
    }

    return listTotalsById.get(selectedList.id) ?? { total: 0, unavailable: false };
  }, [listTotalsById, selectedList]);

  const hasEstimatedItems = useMemo(
    () =>
      selectedList?.type === "budget"
        ? selectedList.items.some((item) => !item.unitPrice)
        : false,
    [selectedList],
  );

  const selectedEntriesTotals = useMemo(() => {
    if (!selectedList || selectedList.type !== "budget") {
      return { total: 0, unavailable: false, estimated: false, hasAny: false };
    }

    let total = 0;
    let unavailable = false;
    let estimated = false;
    let hasAny = false;

    for (const item of selectedList.items) {
      if (!item.completed) {
        continue;
      }

      hasAny = true;
      if (!item.unitPrice) {
        estimated = true;
        continue;
      }

      const subtotal = toNumber(item.quantity) * toNumber(item.unitPrice);
      const converted = convertSubtotal(subtotal, item.currency);
      if (converted == null) {
        unavailable = true;
        continue;
      }

      // Balance convention: incomes positive, expenses negative.
      total += -converted;
    }

    return { total, unavailable, estimated, hasAny };
  }, [convertSubtotal, selectedList]);

  const budgetAppliedSubtotalsByItemId = useMemo(() => {
    const appliedSubtotals = new Map<
      string,
      { appliedPreferred: number | null; originalPreferred: number | null }
    >();
    if (!selectedList || selectedList.type !== "budget") {
      return appliedSubtotals;
    }

    type IncomeSource = {
      itemId: string;
      remaining: number;
    };

    const incomeSources: IncomeSource[] = [];

    for (const item of selectedList.items) {
      if (!item.unitPrice) {
        appliedSubtotals.set(item.id, {
          appliedPreferred: null,
          originalPreferred: null,
        });
        continue;
      }

      const subtotalOriginal = toNumber(item.quantity) * toNumber(item.unitPrice);
      const subtotalPreferred = convertSubtotal(subtotalOriginal, item.currency);
      if (subtotalPreferred == null) {
        appliedSubtotals.set(item.id, {
          appliedPreferred: null,
          originalPreferred: null,
        });
        continue;
      }

      if (subtotalPreferred < 0) {
        if (item.completed) {
          incomeSources.push({
            itemId: item.id,
            remaining: Math.abs(subtotalPreferred),
          });
        }

        appliedSubtotals.set(item.id, {
          appliedPreferred: item.completed ? subtotalPreferred : 0,
          originalPreferred: subtotalPreferred,
        });
        continue;
      }

      appliedSubtotals.set(item.id, {
        appliedPreferred: 0,
        originalPreferred: subtotalPreferred,
      });
    }

    for (const item of selectedList.items) {
      if (!item.unitPrice || !item.completed) {
        continue;
      }

      const subtotalOriginal = toNumber(item.quantity) * toNumber(item.unitPrice);
      const subtotalPreferred = convertSubtotal(subtotalOriginal, item.currency);
      if (subtotalPreferred == null || subtotalPreferred <= 0) {
        continue;
      }

      let remainingExpense = subtotalPreferred;
      for (const source of incomeSources) {
        if (remainingExpense <= 0) {
          break;
        }
        if (source.remaining <= 0) {
          continue;
        }

        const drawnAmount = Math.min(source.remaining, remainingExpense);
        source.remaining -= drawnAmount;
        remainingExpense -= drawnAmount;
      }

      appliedSubtotals.set(item.id, {
        appliedPreferred: subtotalPreferred - remainingExpense,
        originalPreferred: subtotalPreferred,
      });
    }

    for (const source of incomeSources) {
      const current = appliedSubtotals.get(source.itemId);
      appliedSubtotals.set(
        source.itemId,
        {
          appliedPreferred: source.remaining === 0 ? 0 : -source.remaining,
          originalPreferred: current?.originalPreferred ?? null,
        },
      );
    }

    return appliedSubtotals;
  }, [convertSubtotal, selectedList]);

  function startEditing(item: ShoppingItemRecord) {
    const isNeg = Boolean(item.unitPrice && item.unitPrice.startsWith("-"));
    setEditingDraft({
      itemId: item.id,
      name: item.name,
      quantity: item.quantity,
      absPrice: isNeg ? (item.unitPrice?.slice(1) ?? "") : (item.unitPrice ?? ""),
      isNeg,
      currency: item.currency,
    });
  }

  function cancelEditing() {
    setEditingDraft(null);
  }

  async function patchItem(itemId: string, input: ItemUpdateInput) {
    const response = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as MutationErrorResponse;
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to update item.");
    }
  }

  async function toggleItemCompleted(item: ShoppingItemRecord, completed: boolean) {
    setUpdatingItems((current) => ({ ...current, [item.id]: true }));
    setErrorMessage(null);

    try {
      await patchItem(item.id, {
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? undefined,
        currency: item.currency,
        completed,
      });
      await loadLists();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update entry.";
      setErrorMessage(message);
    } finally {
      setUpdatingItems((current) => ({ ...current, [item.id]: false }));
    }
  }

  async function setAllEntriesCompleted(completed: boolean) {
    if (!selectedList) {
      return;
    }

    const entriesToUpdate = selectedList.items.filter(
      (item) => item.completed !== completed,
    );
    if (entriesToUpdate.length === 0) {
      return;
    }

    setBulkUpdatingEntries(true);
    setErrorMessage(null);
    setUpdatingItems((current) => {
      const next = { ...current };
      for (const item of entriesToUpdate) {
        next[item.id] = true;
      }
      return next;
    });

    try {
      await Promise.all(
        entriesToUpdate.map((item) =>
          patchItem(item.id, {
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? undefined,
            currency: item.currency,
            completed,
          }),
        ),
      );
      await loadLists();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update all entries.";
      setErrorMessage(message);
      await loadLists();
    } finally {
      setUpdatingItems((current) => {
        const next = { ...current };
        for (const item of entriesToUpdate) {
          next[item.id] = false;
        }
        return next;
      });
      setBulkUpdatingEntries(false);
    }
  }

  function startTodoEditing(item: ShoppingItemRecord) {
    setTodoEditItemId(item.id);
    setTodoEditName(item.name);
  }

  function cancelTodoEditing() {
    setTodoEditItemId(null);
    setTodoEditName("");
  }

  async function saveTodoEntry(item: ShoppingItemRecord) {
    if (!todoEditItemId || todoEditItemId !== item.id) {
      return;
    }

    const trimmedName = todoEditName.trim();
    if (!trimmedName) {
      setErrorMessage("Todo entry name cannot be empty.");
      return;
    }

    setUpdatingItems((current) => ({ ...current, [item.id]: true }));
    setErrorMessage(null);
    try {
      await patchItem(item.id, {
        name: trimmedName,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? undefined,
        currency: item.currency,
        completed: item.completed,
      });
      cancelTodoEditing();
      await loadLists();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save todo entry.";
      setErrorMessage(message);
    } finally {
      setUpdatingItems((current) => ({ ...current, [item.id]: false }));
    }
  }

  async function saveEditedItem() {
    if (!editingDraft) return;

    const editingItem = selectedList?.items.find(
      (item) => item.id === editingDraft.itemId,
    );

    const trimmedPrice = editingDraft.absPrice.trim();
    const finalPrice =
      trimmedPrice === ""
        ? undefined
        : editingDraft.isNeg
          ? `-${trimmedPrice}`
          : trimmedPrice;

    setSavingItem(true);
    setErrorMessage(null);

    try {
      await patchItem(editingDraft.itemId, {
        name: editingDraft.name,
        quantity: editingDraft.quantity,
        currency: editingDraft.currency,
        unitPrice: finalPrice,
        completed: editingItem?.completed ?? false,
      });

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
        body: JSON.stringify({ name: trimmedName, type: newListType }),
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
      setNewListType("budget");
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
    if (!window.confirm("Delete this list and all its entries?")) {
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
      normalizedUnitPrice === ""
        ? undefined
        : newItemPriceNegative
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
          currency: newItem.currency,
          completed: newItemCompleted,
          ...(finalPrice === undefined ? {} : { unitPrice: finalPrice }),
        }),
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add item.");
      }

      setNewItem(defaultNewItem);
      setNewItemCustomAmount(false);
      setNewItemPriceNegative(false);
      setNewItemCompleted(false);
      await loadLists();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add item.";
      setErrorMessage(message);
    } finally {
      setCreatingItem(false);
    }
  }

  async function renameList(listId: string, currentName: string) {
    const proposedName = window.prompt("Rename list", currentName);
    if (proposedName == null) {
      return;
    }

    const trimmedName = proposedName.trim();
    if (!trimmedName) {
      setErrorMessage("List name cannot be empty.");
      return;
    }

    if (trimmedName === currentName) {
      return;
    }

    setRenamingLists((current) => ({ ...current, [listId]: true }));
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to rename list.");
      }

      await loadLists();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to rename list.";
      setErrorMessage(message);
    } finally {
      setRenamingLists((current) => ({ ...current, [listId]: false }));
    }
  }

  async function persistReorderedItems(listId: string, itemIds: string[]) {
    const response = await fetch("/api/items/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, itemIds }),
    });
    const payload = (await response.json()) as MutationErrorResponse;
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to reorder entries.");
    }
  }

  async function persistReorderedLists(listIds: string[]) {
    const response = await fetch("/api/lists/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listIds }),
    });
    const payload = (await response.json()) as MutationErrorResponse;
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to reorder lists.");
    }
  }

  async function handleListsDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) {
      return;
    }

    const oldIndex = lists.findIndex((list) => list.id === activeId);
    const newIndex = lists.findIndex((list) => list.id === overId);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reorderedLists = arrayMove(lists, oldIndex, newIndex).map((list, index) => ({
      ...list,
      sortOrder: index,
    }));

    setLists(reorderedLists);
    setReorderingLists(true);
    setErrorMessage(null);

    try {
      await persistReorderedLists(reorderedLists.map((list) => list.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reorder lists.";
      setErrorMessage(message);
      await loadLists();
    } finally {
      setReorderingLists(false);
    }
  }

  async function handleEntriesDragEnd(event: DragEndEvent) {
    if (!selectedList) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) {
      return;
    }

    const oldIndex = selectedList.items.findIndex((item) => item.id === activeId);
    const newIndex = selectedList.items.findIndex((item) => item.id === overId);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reorderedItems = arrayMove(selectedList.items, oldIndex, newIndex).map(
      (item, index) => ({
        ...item,
        sortOrder: index,
      }),
    );

    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === selectedList.id ? { ...list, items: reorderedItems } : list,
      ),
    );
    setReorderingItems(true);
    setErrorMessage(null);

    try {
      await persistReorderedItems(
        selectedList.id,
        reorderedItems.map((item) => item.id),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reorder entries.";
      setErrorMessage(message);
      await loadLists();
    } finally {
      setReorderingItems(false);
    }
  }

  async function addTodoEntry() {
    if (!selectedListId || selectedList?.type !== "todo") {
      setErrorMessage("Select a todo list before adding an entry.");
      return;
    }

    const trimmedName = newTodoEntryName.trim();
    if (!trimmedName) {
      setErrorMessage("Todo entry name cannot be empty.");
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
          name: trimmedName,
          quantity: "1",
          currency: "USD",
          completed: false,
        }),
      });
      const payload = (await response.json()) as MutationErrorResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add todo entry.");
      }

      setNewTodoEntryName("");
      await loadLists();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to add todo entry.";
      setErrorMessage(message);
    } finally {
      setCreatingItem(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!window.confirm("Remove this entry from the list?")) {
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
    <div className="flex flex-col gap-6">
      <aside className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold leading-tight text-zinc-100 sm:text-xl">
                Your Lists
              </h2>
              <button
                type="button"
                onClick={() => void refreshFromServer()}
                disabled={refreshingLists || loadingLists}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-zinc-800/60 px-2 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                title="Fetch latest lists from the online database"
              >
                <RefreshIcon />
                <span>{refreshingLists ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
            <label className="flex w-full items-center gap-2 text-xs text-zinc-400 sm:w-auto sm:text-sm">
              Totals in
              <select
                value={preferredCurrency}
                onChange={(event) => setPreferredCurrency(event.target.value as DisplayCurrency)}
                className="rounded-md border border-white/15 bg-zinc-950/80 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-400/60 focus:outline-none sm:text-sm"
              >
                {displayCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
              placeholder="New list name"
              className="w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
            />
            <select
              value={newListType}
              onChange={(event) => setNewListType(event.target.value as ListType)}
              className="rounded-xl border border-white/10 bg-zinc-950/80 px-2 py-2 text-sm text-zinc-200 focus:border-cyan-400/60 focus:outline-none"
            >
              <option value="budget">Budget</option>
              <option value="todo">Todo</option>
            </select>
            <button
              type="button"
              onClick={() => void createList()}
              disabled={creatingList}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {loadingLists && <p className="text-base text-zinc-400">Loading lists...</p>}
          {!loadingLists && lists.length === 0 && (
            <p className="text-base text-zinc-400">Create your first list.</p>
          )}
          {lists.length > 0 && (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                void handleListsDragEnd(event);
              }}
            >
              <SortableContext items={listIds} strategy={verticalListSortingStrategy}>
                {lists.map((list) => {
                  const active = list.id === selectedListId;
                  const isDeleting = Boolean(deletingLists[list.id]);
                  const isRenaming = Boolean(renamingLists[list.id]);
                  const isListDragDisabled = listDragDisabled || isDeleting || isRenaming;

                  return (
                    <SortableRow
                      key={list.id}
                      id={list.id}
                      disabled={isListDragDisabled}
                    >
                      {({ attributes, listeners, isDragging }) => (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedListId(list.id);
                            setEditingDraft(null);
                            setTodoEditItemId(null);
                            setTodoEditName("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedListId(list.id);
                              setEditingDraft(null);
                              setTodoEditItemId(null);
                              setTodoEditName("");
                            }
                          }}
                          className={`flex cursor-pointer items-start justify-between rounded-md border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 sm:items-center ${
                            active
                              ? "border-cyan-400/50 bg-zinc-800/80 shadow-lg shadow-cyan-950/30"
                              : "border-white/10 bg-zinc-900/70 hover:bg-zinc-800/80"
                          } ${isDragging ? "ring-1 ring-cyan-400/40 opacity-90" : ""}`}
                        >
                          <div className="mr-2">
                            <button
                              type="button"
                              {...attributes}
                              {...listeners}
                              onClick={(event) => event.stopPropagation()}
                              disabled={isListDragDisabled}
                              className="flex h-8 w-8 touch-none cursor-grab items-center justify-center rounded-lg border border-white/15 bg-zinc-800/60 text-zinc-300 transition hover:bg-zinc-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                              title="Hold and drag to reorder list"
                              aria-label={`Hold and drag to reorder ${list.name}`}
                            >
                              <DragHandleIcon />
                            </button>
                          </div>
                          <div className="min-w-0 flex-1 cursor-pointer">
                            <p className="whitespace-pre-line break-words text-left text-sm font-medium leading-snug text-zinc-100 sm:text-base">
                              {list.name}
                            </p>
                            {list.type === "budget" ? (
                              <p className="mt-0.5 whitespace-pre-line break-words text-left text-xs leading-snug text-zinc-500 sm:text-sm">
                                Total:{" "}
                                {listTotalsById.get(list.id)?.unavailable
                                  ? "Rate unavailable"
                                  : (
                                    <FormattedCurrency
                                      value={listTotalsById.get(list.id)?.total ?? 0}
                                      currency={preferredCurrency}
                                    />
                                  )}
                              </p>
                            ) : (
                              <p className="mt-0.5 whitespace-pre-line break-words text-left text-xs leading-snug text-zinc-500 sm:text-sm">
                                Todo list
                              </p>
                            )}
                          </div>
                          <div className="ml-2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void renameList(list.id, list.name);
                              }}
                              disabled={isRenaming || isDeleting}
                              title="Rename list"
                              className="flex h-7 items-center gap-1 rounded-md border border-white/15 bg-zinc-800/60 px-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <PencilIcon />
                              <span className="hidden md:inline">
                                {isRenaming ? "Saving..." : "Rename"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void removeList(list.id);
                              }}
                              disabled={isDeleting || isRenaming}
                              className="rounded px-2 py-1 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </SortableRow>
                  );
                })}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </aside>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/30 backdrop-blur">
        {!selectedList && (
          <p className="text-sm text-zinc-400">
            Select or create a list to start adding entries.
          </p>
        )}

        {selectedList && (
          <div className="space-y-4">
            {/* Budget header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-zinc-100">{selectedList.name}</h2>
              {selectedList.type === "budget" ? (
                <p
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                    selectedListTotals.unavailable
                      ? "border-rose-400/40 bg-rose-500/10 text-rose-300"
                      : hasEstimatedItems
                        ? "border-amber-400/50 bg-amber-500/10 text-amber-200"
                        : -selectedListTotals.total > 0
                          ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                          : -selectedListTotals.total < 0
                            ? "border-rose-400/40 bg-rose-500/10 text-rose-300"
                            : "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  }`}
                >
                  {selectedListTotals.unavailable ? (
                    "Net total unavailable (exchange rates needed)"
                  ) : (
                    <>
                      {hasEstimatedItems ? "Est. " : ""}Net total:{" "}
                      <FormattedCurrency
                        value={-selectedListTotals.total}
                        currency={preferredCurrency}
                      />
                      {hasEstimatedItems && (
                        <span className="ml-1 text-xs opacity-70">(some prices TBD)</span>
                      )}
                      {selectedEntriesTotals.hasAny && !selectedEntriesTotals.unavailable && (
                        <span className="ml-1 opacity-80">
                          {" ("}
                          {selectedEntriesTotals.estimated ? (
                            <span className="text-xs opacity-70">TBD</span>
                          ) : (
                            <FormattedCurrency
                              value={selectedEntriesTotals.total}
                              currency={preferredCurrency}
                            />
                          )}
                          {")"}
                        </span>
                      )}
                    </>
                  )}
                </p>
              ) : (
                <p className="rounded-full border border-white/15 bg-zinc-800/60 px-3 py-1 text-sm font-semibold text-zinc-300">
                  Todo List
                </p>
              )}
            </div>
            {selectedList.type === "budget" && (exchangeRatesLoading || exchangeRatesError) && (
              <p className="text-xs text-zinc-500">
                {exchangeRatesLoading
                  ? "Refreshing exchange rates..."
                  : `Exchange rates unavailable: ${exchangeRatesError}`}
              </p>
            )}

            {selectedList.type === "budget" ? (
              <>
                {/* Add item form */}
                <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 space-y-2">
                  {/* Row 1: name + custom amount toggle */}
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      value={newItem.name}
                      onChange={(event) =>
                        setNewItem((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Entry name"
                      className="min-w-0 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none sm:flex-1"
                    />
                    <label className="flex w-full cursor-pointer select-none items-center gap-2 whitespace-nowrap text-sm text-zinc-400 sm:w-auto">
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
                    <label className="flex w-full cursor-pointer select-none items-center gap-2 whitespace-nowrap text-sm text-zinc-400 sm:w-auto">
                      <input
                        type="checkbox"
                        checked={newItemCompleted}
                        onChange={(event) => setNewItemCompleted(event.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      Checked
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
                        className="w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none sm:w-20"
                      />
                    )}

                    <div className="flex min-w-0 w-full items-center gap-1.5 sm:flex-1">
                      <button
                        type="button"
                        onClick={() => setNewItemPriceNegative((n) => !n)}
                        title={newItemPriceNegative ? "Currently: income (−). Click to switch to expense (+)." : "Currently: expense (+). Click to switch to income (−)."}
                        className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
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
                      <select
                        value={newItem.currency}
                        onChange={(event) =>
                          setNewItem((current) => ({
                            ...current,
                            currency: event.target.value as EntryCurrency,
                          }))
                        }
                        className="w-20 shrink-0 rounded-xl border border-white/10 bg-zinc-950/80 px-2.5 py-2.5 text-sm text-zinc-100 focus:border-cyan-400/60 focus:outline-none"
                      >
                        {entryCurrencies.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => void addItem()}
                      disabled={creatingItem}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
                    <>
                      <div className="flex items-center justify-end px-1">
                        <button
                          type="button"
                          onClick={() => void setAllEntriesCompleted(!selectedListAllEntriesChecked)}
                          disabled={checkAllEntriesDisabled}
                          className="rounded-md border border-white/20 bg-zinc-800/60 px-2 py-1 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {bulkUpdatingEntries
                            ? "Updating..."
                            : selectedListAllEntriesChecked
                              ? "Uncheck all"
                              : "Check all"}
                        </button>
                      </div>
                      <div className="hidden md:grid md:grid-cols-[2rem_2rem_minmax(0,1fr)_8.5rem_8.5rem_11rem] items-center gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        <span className="text-center">Check</span>
                        <span className="text-center">Move</span>
                        <span>Entry</span>
                        <span className="text-right">Qty x Price</span>
                        <span className="text-right">Subtotal</span>
                        <span className="text-right">Actions</span>
                      </div>
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                          void handleEntriesDragEnd(event);
                        }}
                      >
                        <SortableContext
                          items={selectedListItemIds}
                          strategy={verticalListSortingStrategy}
                        >
                          {selectedList.items.map((item) => {
                            const isNeg = Boolean(item.unitPrice && item.unitPrice.startsWith("-"));
                            const isTbd = !item.unitPrice;
                            const subtotalOriginal = toNumber(item.quantity) * toNumber(item.unitPrice);
                            const isIncome = !isTbd && isNeg;
                            const subtotalSummary = budgetAppliedSubtotalsByItemId.get(item.id);
                            const appliedSubtotalPreferred =
                              subtotalSummary?.appliedPreferred ??
                              (isTbd ? null : convertSubtotal(subtotalOriginal, item.currency));
                            const originalSubtotalPreferred =
                              subtotalSummary?.originalPreferred ??
                              (isTbd ? null : convertSubtotal(subtotalOriginal, item.currency));
                            const isDeleting = Boolean(deletingItems[item.id]);
                            const isUpdating = Boolean(updatingItems[item.id]);
                            const isThisEditing = editingDraft?.itemId === item.id;
                            const isItemDragDisabled = dragDisabled || isDeleting || isUpdating;
                            const isTallMode = Boolean(entryTallModeById[item.id]);
                            const epsilon = 0.000001;
                            const isConversionUnavailable =
                              !isTbd && originalSubtotalPreferred == null;
                            const isSourceDepleted =
                              isIncome &&
                              appliedSubtotalPreferred != null &&
                              Math.abs(appliedSubtotalPreferred) <= epsilon;
                            const isPendingExpense =
                              !isTbd &&
                              !isConversionUnavailable &&
                              !isIncome &&
                              item.completed &&
                              appliedSubtotalPreferred != null &&
                              originalSubtotalPreferred != null &&
                              originalSubtotalPreferred - appliedSubtotalPreferred > epsilon;

                            const rowTheme = isTbd
                              ? "border-amber-400/30 bg-amber-500/5"
                              : isConversionUnavailable
                                ? item.completed
                                  ? "border-rose-400/35 bg-rose-500/10"
                                  : "border-rose-400/20 bg-zinc-900/60"
                              : isIncome
                                ? item.completed
                                  ? isSourceDepleted
                                    ? "border-emerald-500/30 bg-emerald-500/5"
                                    : "border-emerald-400/40 bg-emerald-500/15"
                                  : "border-emerald-500/20 bg-zinc-900/60"
                                : item.completed
                                  ? isPendingExpense
                                    ? "border-amber-400/35 bg-amber-500/10"
                                    : "border-white/10 bg-zinc-950/40"
                                  : "border-white/10 bg-zinc-900/70";

                            const appliedSubtotalColor = isTbd
                              ? "text-amber-300"
                              : isConversionUnavailable
                                ? "text-rose-300"
                              : isIncome
                                ? item.completed
                                  ? isSourceDepleted
                                    ? "text-emerald-200/75"
                                    : "text-emerald-300"
                                  : "text-emerald-300/60"
                                : item.completed
                                  ? isPendingExpense
                                    ? "text-amber-200"
                                    : "text-zinc-100"
                                  : "text-zinc-500";

                            const originalSubtotalColor = isTbd
                              ? "text-amber-300/70"
                              : isIncome
                                ? "text-emerald-200/70"
                                : "text-zinc-500";

                            const entryTitleColor = isTbd
                              ? "text-zinc-100"
                              : isIncome
                                ? item.completed
                                  ? "text-zinc-100"
                                  : "text-emerald-200/65"
                                : item.completed
                                  ? "text-zinc-100"
                                  : "text-zinc-500";

                            const qtyPriceColor =
                              !isTbd && !isIncome && !item.completed
                                ? "text-zinc-500"
                                : "text-zinc-400";

                            const expenseRemainingSubtotalPreferred =
                              !isTbd &&
                              !isConversionUnavailable &&
                              !isIncome &&
                              appliedSubtotalPreferred != null &&
                              originalSubtotalPreferred != null
                                ? Math.max(
                                    originalSubtotalPreferred - appliedSubtotalPreferred,
                                    0,
                                  )
                                : null;
                            const appliedSubtotalDisplay: ReactNode =
                              isTbd
                                ? "TBD"
                                : isConversionUnavailable
                                  ? "Rates"
                                  : (
                                    <FormattedCurrency
                                      value={expenseRemainingSubtotalPreferred ?? appliedSubtotalPreferred ?? 0}
                                      currency={preferredCurrency}
                                    />
                                  );
                            const originalSubtotalDisplay: ReactNode = isTbd
                              ? "TBD"
                              : <FormattedCurrency value={subtotalOriginal} currency={item.currency} />;

                            return (
                              <SortableRow
                                key={item.id}
                                id={item.id}
                                disabled={isItemDragDisabled}
                              >
                                {({ attributes, listeners, isDragging }) => {
                                  if (isThisEditing && editingDraft) {
                                    return (
                                      <div
                                        className={`rounded-xl border p-3 space-y-2 ${rowTheme}`}
                                      >
                                        <input
                                          value={editingDraft.name}
                                          onChange={(e) =>
                                            setEditingDraft((d) =>
                                              d ? { ...d, name: e.target.value } : d,
                                            )
                                          }
                                          placeholder="Entry name"
                                          className="w-full rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none"
                                        />

                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                          <input
                                            value={editingDraft.quantity}
                                            onChange={(e) =>
                                              setEditingDraft((d) =>
                                                d ? { ...d, quantity: e.target.value } : d,
                                              )
                                            }
                                            inputMode="decimal"
                                            placeholder="Qty"
                                            className="w-16 rounded-lg border border-white/10 bg-zinc-950/80 px-2.5 py-2 text-sm text-zinc-100 focus:border-cyan-400/60 focus:outline-none"
                                          />

                                          <div className="flex min-w-0 w-full items-center gap-1 sm:w-auto sm:flex-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setEditingDraft((d) =>
                                                  d ? { ...d, isNeg: !d.isNeg } : d,
                                                )
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
                                                setEditingDraft((d) =>
                                                  d ? { ...d, absPrice: e.target.value } : d,
                                                )
                                              }
                                              inputMode="decimal"
                                              placeholder="Price (TBD)"
                                              className="min-w-0 flex-1 rounded-lg border bg-zinc-950/80 px-2.5 py-2 text-sm text-zinc-100 focus:outline-none border-white/10 focus:border-cyan-400/60"
                                            />
                                            <select
                                              value={editingDraft.currency}
                                              onChange={(e) =>
                                                setEditingDraft((d) =>
                                                  d
                                                    ? {
                                                        ...d,
                                                        currency: e.target.value as EntryCurrency,
                                                      }
                                                    : d,
                                                )
                                              }
                                              className="w-20 rounded-lg border border-white/10 bg-zinc-950/80 px-2 py-2 text-sm text-zinc-100 focus:border-cyan-400/60 focus:outline-none"
                                            >
                                              {entryCurrencies.map((currency) => (
                                                <option key={currency} value={currency}>
                                                  {currency}
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          <div className="ml-auto flex w-full justify-end gap-2 sm:w-auto">
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

                                  const qtyNum = toNumber(item.quantity);
                                  const priceDisplay: ReactNode = isTbd
                                    ? "TBD"
                                    : <FormattedCurrency value={Math.abs(toNumber(item.unitPrice))} currency={item.currency} />;
                                  const completionLabel = isIncome
                                    ? `Use ${item.name} as source`
                                    : `Mark ${item.name} as completed`;

                                  const completionCheckbox = (
                                    <input
                                      type="checkbox"
                                      checked={item.completed}
                                      onChange={(e) =>
                                        void toggleItemCompleted(item, e.target.checked)
                                      }
                                      disabled={isDeleting || isUpdating}
                                      className={`h-4 w-4 rounded disabled:cursor-not-allowed disabled:opacity-60 md:mx-auto ${
                                        isIncome ? "accent-emerald-400" : "accent-cyan-400"
                                      }`}
                                      aria-label={completionLabel}
                                    />
                                  );

                                  const subtotalDisplay = (
                                    <span className="flex min-w-0 flex-col text-left tabular-nums md:items-end md:text-right">
                                      <span className={`text-sm font-semibold ${appliedSubtotalColor}`}>
                                        {appliedSubtotalDisplay}
                                      </span>
                                      <span
                                        className={`text-[11px] font-semibold ${originalSubtotalColor}`}
                                      >
                                        {originalSubtotalDisplay}
                                      </span>
                                    </span>
                                  );

                                  const editButton = (
                                    <button
                                      type="button"
                                      onClick={() => startEditing(item)}
                                      disabled={isDeleting || isUpdating}
                                      title="Edit entry"
                                      aria-label="Edit entry"
                                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-zinc-800/60 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <PencilIcon />
                                      <span>Edit</span>
                                    </button>
                                  );

                                  const deleteButton = (
                                    <button
                                      type="button"
                                      onClick={() => void removeItem(item.id)}
                                      disabled={isDeleting || isUpdating}
                                      title="Delete entry"
                                      aria-label="Delete entry"
                                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <TrashIcon />
                                      <span>Delete</span>
                                    </button>
                                  );

                                  if (isTallMode) {
                                    return (
                                      <div
                                        className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 md:grid md:grid-cols-[2rem_2rem_minmax(0,1fr)_8.5rem_8.5rem_11rem] md:items-center md:gap-3 ${rowTheme} ${
                                          isDragging ? "ring-1 ring-cyan-400/40 opacity-90" : ""
                                        }`}
                                      >
                                        <div className="flex min-w-0 items-center gap-3 md:contents">
                                          {completionCheckbox}
                                          <button
                                            type="button"
                                            {...attributes}
                                            {...listeners}
                                            disabled={isItemDragDisabled}
                                            className="mx-auto flex h-8 w-8 touch-none cursor-grab items-center justify-center rounded-lg border border-white/15 bg-zinc-800/60 text-zinc-300 transition hover:bg-zinc-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                                            title="Hold and drag to reorder"
                                            aria-label={`Hold and drag to reorder ${item.name}`}
                                          >
                                            <DragHandleIcon />
                                          </button>
                                          <span
                                            ref={(node) => setEntryTitleRef(item.id, node)}
                                            className={`min-w-0 flex-1 break-words text-sm font-medium leading-snug md:flex-none md:leading-normal ${entryTitleColor}`}
                                          >
                                            {item.name || (
                                              <span className="italic text-zinc-500">Unnamed entry</span>
                                            )}
                                          </span>
                                        </div>

                                        <div className="flex min-w-0 items-center gap-2 pl-[3.25rem] md:contents md:pl-0">
                                          <span
                                            className={`hidden min-w-0 flex-1 break-words text-xs tabular-nums sm:block md:whitespace-nowrap md:text-right ${qtyPriceColor}`}
                                          >
                                            {qtyNum !== 1 ? <>{item.quantity} × {priceDisplay}</> : priceDisplay}
                                          </span>

                                          {subtotalDisplay}

                                          <div className="ml-auto flex shrink-0 items-center justify-end gap-1">
                                            {editButton}
                                            {deleteButton}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 md:grid md:grid-cols-[2rem_2rem_minmax(0,1fr)_8.5rem_8.5rem_11rem] md:items-center md:gap-3 ${rowTheme} ${
                                        isDragging ? "ring-1 ring-cyan-400/40 opacity-90" : ""
                                      }`}
                                    >
                                      <div className="flex min-w-0 items-center gap-3 md:contents">
                                        {completionCheckbox}
                                        <button
                                          type="button"
                                          {...attributes}
                                          {...listeners}
                                          disabled={isItemDragDisabled}
                                          className="mx-auto flex h-8 w-8 touch-none cursor-grab items-center justify-center rounded-lg border border-white/15 bg-zinc-800/60 text-zinc-300 transition hover:bg-zinc-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                                          title="Hold and drag to reorder"
                                          aria-label={`Hold and drag to reorder ${item.name}`}
                                        >
                                          <DragHandleIcon />
                                        </button>

                                        <span
                                          ref={(node) => setEntryTitleRef(item.id, node)}
                                          className={`min-w-0 flex-1 truncate text-sm font-medium md:flex-none ${entryTitleColor}`}
                                        >
                                          {item.name || (
                                            <span className="italic text-zinc-500">Unnamed entry</span>
                                          )}
                                        </span>
                                      </div>

                                      <div className="flex min-w-0 items-center gap-2 pl-[3.25rem] md:contents md:pl-0">
                                        <span className={`hidden whitespace-nowrap text-right text-xs tabular-nums md:block ${qtyPriceColor}`}>
                                          {qtyNum !== 1 ? <>{item.quantity} × {priceDisplay}</> : priceDisplay}
                                        </span>

                                        {subtotalDisplay}

                                        <div className="ml-auto flex shrink-0 items-center justify-end gap-1 md:ml-0">
                                          {editButton}
                                          {deleteButton}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }}
                              </SortableRow>
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={newTodoEntryName}
                      onChange={(event) => setNewTodoEntryName(event.target.value)}
                      placeholder="New todo entry"
                      className="min-w-0 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none sm:flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => void addTodoEntry()}
                      disabled={creatingItem}
                      className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Add Entry
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {selectedList.items.length === 0 && (
                    <p className="py-4 text-center text-sm text-zinc-400">
                      No todo entries yet. Add your first task above.
                    </p>
                  )}
                  {selectedList.items.length > 0 && (
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => {
                        void handleEntriesDragEnd(event);
                      }}
                    >
                      <SortableContext
                        items={selectedListItemIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {selectedList.items.map((item) => {
                          const isDeleting = Boolean(deletingItems[item.id]);
                          const isUpdating = Boolean(updatingItems[item.id]);
                          const isEditing = todoEditItemId === item.id;
                          const isItemDragDisabled = dragDisabled || isDeleting || isUpdating;
                          const isTallMode = Boolean(entryTallModeById[item.id]);

                          return (
                            <SortableRow
                              key={item.id}
                              id={item.id}
                              disabled={isItemDragDisabled}
                            >
                              {({ attributes, listeners, isDragging }) => {
                                if (isEditing) {
                                  return (
                                    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2.5">
                                      <input
                                        type="checkbox"
                                        checked={item.completed}
                                        onChange={(e) =>
                                          void toggleItemCompleted(item, e.target.checked)
                                        }
                                        disabled={isDeleting || isUpdating}
                                        className="h-4 w-4 rounded accent-cyan-400"
                                        aria-label={`Mark ${item.name} as completed`}
                                      />
                                      <input
                                        value={todoEditName}
                                        onChange={(e) => setTodoEditName(e.target.value)}
                                        className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/60 focus:outline-none sm:w-auto"
                                      />
                                      <div className="ml-auto flex w-full justify-end gap-2 sm:w-auto">
                                        <button
                                          type="button"
                                          onClick={() => void saveTodoEntry(item)}
                                          disabled={isUpdating}
                                          className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelTodoEditing}
                                          disabled={isUpdating}
                                          className="rounded-lg border border-white/20 bg-zinc-800/70 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                const editButton = (
                                  <button
                                    type="button"
                                    onClick={() => startTodoEditing(item)}
                                    disabled={isDeleting || isUpdating}
                                    title="Edit entry"
                                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-zinc-800/60 px-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <PencilIcon />
                                    <span>Edit</span>
                                  </button>
                                );

                                const deleteButton = (
                                  <button
                                    type="button"
                                    onClick={() => void removeItem(item.id)}
                                    disabled={isDeleting || isUpdating}
                                    title="Delete entry"
                                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <TrashIcon />
                                    <span>Delete</span>
                                  </button>
                                );

                                if (isTallMode) {
                                  return (
                                    <div
                                      className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 md:grid md:grid-cols-[2rem_2rem_minmax(0,1fr)_11rem] md:items-center md:gap-3 ${
                                        item.completed
                                          ? "border-white/10 bg-zinc-900/70"
                                          : "border-white/10 bg-zinc-950/40"
                                      } ${isDragging ? "ring-1 ring-cyan-400/40 opacity-90" : ""}`}
                                    >
                                      <div className="flex min-w-0 items-center gap-3 md:contents">
                                        <input
                                          type="checkbox"
                                          checked={item.completed}
                                          onChange={(e) =>
                                            void toggleItemCompleted(item, e.target.checked)
                                          }
                                          disabled={isDeleting || isUpdating}
                                          className="h-4 w-4 rounded accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 md:mx-auto"
                                          aria-label={`Mark ${item.name} as completed`}
                                        />
                                        <button
                                          type="button"
                                          {...attributes}
                                          {...listeners}
                                          disabled={isItemDragDisabled}
                                          className="flex h-8 w-8 touch-none cursor-grab items-center justify-center rounded-lg border border-white/15 bg-zinc-800/60 text-zinc-300 transition hover:bg-zinc-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 md:mx-auto"
                                          title="Hold and drag to reorder"
                                          aria-label={`Hold and drag to reorder ${item.name}`}
                                        >
                                          <DragHandleIcon />
                                        </button>
                                        <span
                                          ref={(node) => setEntryTitleRef(item.id, node)}
                                          className={`min-w-0 flex-1 break-words text-sm leading-snug md:flex-none md:leading-normal ${
                                            item.completed
                                              ? "text-zinc-500 line-through"
                                              : "text-zinc-100"
                                          }`}
                                        >
                                          {item.name || (
                                            <span className="italic text-zinc-500">Unnamed entry</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="pl-[3.25rem] md:contents md:pl-0">
                                        <div className="flex items-center justify-end gap-1.5">
                                          {editButton}
                                          {deleteButton}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 md:grid md:grid-cols-[2rem_2rem_minmax(0,1fr)_11rem] md:items-center md:gap-3 ${
                                      item.completed
                                        ? "border-white/10 bg-zinc-900/70"
                                        : "border-white/10 bg-zinc-950/40"
                                    } ${isDragging ? "ring-1 ring-cyan-400/40 opacity-90" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={item.completed}
                                      onChange={(e) =>
                                        void toggleItemCompleted(item, e.target.checked)
                                      }
                                      disabled={isDeleting || isUpdating}
                                      className="h-4 w-4 rounded accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 md:mx-auto"
                                      aria-label={`Mark ${item.name} as completed`}
                                    />
                                    <button
                                      type="button"
                                      {...attributes}
                                      {...listeners}
                                      disabled={isItemDragDisabled}
                                      className="flex h-8 w-8 touch-none cursor-grab items-center justify-center rounded-lg border border-white/15 bg-zinc-800/60 text-zinc-300 transition hover:bg-zinc-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 md:mx-auto"
                                      title="Hold and drag to reorder"
                                      aria-label={`Hold and drag to reorder ${item.name}`}
                                    >
                                      <DragHandleIcon />
                                    </button>
                                    <span
                                      ref={(node) => setEntryTitleRef(item.id, node)}
                                      className={`min-w-0 flex-1 truncate text-sm md:flex-none ${
                                        item.completed
                                          ? "text-zinc-500 line-through"
                                          : "text-zinc-100"
                                      }`}
                                    >
                                      {item.name}
                                    </span>
                                    <div className="flex shrink-0 items-center justify-end gap-1.5">
                                      {editButton}
                                      {deleteButton}
                                    </div>
                                  </div>
                                );
                              }}
                            </SortableRow>
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </>
            )}
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


