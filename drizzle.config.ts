import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
