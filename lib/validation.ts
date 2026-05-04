import { z } from "zod";

const quantityRegex = /^\d+(\.\d{1,3})?$/;
const unitPriceRegex = /^\d+(\.\d{1,2})?$/;

const normalizedString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(120));

const quantityString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().regex(quantityRegex, "Quantity supports up to 3 decimals."))
  .refine((value) => Number(value) > 0, "Quantity must be greater than 0.");

const unitPriceString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().regex(unitPriceRegex, "Price supports up to 2 decimals."))
  .refine((value) => Number(value) >= 0, "Price cannot be negative.");

export const createListSchema = z.object({
  name: normalizedString,
});

export const createItemSchema = z.object({
  listId: z.string().uuid(),
  name: normalizedString,
  quantity: quantityString,
  unitPrice: unitPriceString,
});

export const updateItemSchema = z.object({
  name: normalizedString,
  quantity: quantityString,
  unitPrice: unitPriceString,
});

export const idParamSchema = z.string().uuid();
