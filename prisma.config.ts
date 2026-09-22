import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 keeps the connection URL here (not in schema.prisma). dotenv is loaded explicitly because Prisma no longer reads .env itself.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
