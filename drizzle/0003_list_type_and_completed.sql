ALTER TABLE "shopping_items" ADD COLUMN "completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD COLUMN "type" varchar(16) DEFAULT 'budget' NOT NULL;