ALTER TABLE "shopping_items" ALTER COLUMN "unit_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_items" ALTER COLUMN "unit_price" DROP DEFAULT;
