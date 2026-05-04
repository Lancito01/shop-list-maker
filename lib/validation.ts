import { z } from "zod";

const quantityRegex = /^\d+(\.\d{1,3})?$/;
const unitPriceRegex = /^-?\d+(\.\d{1,2})?$/;
const entryCurrencySchema = z.enum(["USD", "EUR", "ARS"]);

const normalizedString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(120));

const quantityString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().regex(quantityRegex, "Quantity supports up to 3 decimals."))
  .refine((value) => Number(value) > 0, "Quantity must be greater than 0.");

const optionalUnitPriceString = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value.trim() === "") return undefined;
    return value.trim();
  })
  .refine(
    (value) => value === undefined || unitPriceRegex.test(value),
    { message: "Price must be a number with up to 2 decimals (negative values allowed)." },
  );

export const createListSchema = z.object({
  name: normalizedString,
});

export const createItemSchema = z.object({
  listId: z.string().uuid(),
  name: normalizedString,
  quantity: quantityString,
  unitPrice: optionalUnitPriceString,
  currency: entryCurrencySchema.optional().default("USD"),
});

export const updateItemSchema = z.object({
  name: normalizedString,
  quantity: quantityString,
  unitPrice: optionalUnitPriceString,
  currency: entryCurrencySchema,
});

export const idParamSchema = z.string().uuid();
