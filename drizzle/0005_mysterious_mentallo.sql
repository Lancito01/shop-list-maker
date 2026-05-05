ALTER TABLE "shopping_lists" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH ranked_lists AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC, created_at DESC
    ) - 1 AS next_sort_order
  FROM shopping_lists
)
UPDATE shopping_lists
SET sort_order = ranked_lists.next_sort_order
FROM ranked_lists
WHERE shopping_lists.id = ranked_lists.id;--> statement-breakpoint
CREATE INDEX "shopping_lists_user_sort_order_idx" ON "shopping_lists" USING btree ("user_id","sort_order");
