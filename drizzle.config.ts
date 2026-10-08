// drizzle-kit reads this to diff src/db/schema.ts against ./drizzle and emit
// the next numbered migration (npm run db:generate).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.VITALS_DB_PATH ?? ".data/vitals.db",
  },
});
