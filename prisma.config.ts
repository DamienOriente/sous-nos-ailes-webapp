import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI needs a datasource URL even for `prisma generate` (no connection is
// opened). Fall back to the documented local Compose database so that Docker
// builds and fresh checkouts work without a .env file.
const LOCAL_DATABASE_URL = "postgresql://lpi:lpi@localhost:5440/lpi";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
  },
});
