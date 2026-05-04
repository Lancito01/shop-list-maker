import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

let dbInstance: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Missing database URL. Set POSTGRES_URL (from Vercel) or DATABASE_URL.",
    );
  }

  dbInstance = drizzle({
    client: neon(databaseUrl),
    schema,
  });

  return dbInstance;
}
