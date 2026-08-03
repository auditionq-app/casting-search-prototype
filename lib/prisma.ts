// lib/prisma.ts

// Uses the Prisma singleton pattern (avoids exhausting DB connections from
// hot-reload in dev). Import path matches the custom generator output in
// schema.prisma: generator client { output = "../app/generated/prisma" }
//
// Prisma 7's new "prisma-client" generator (used here, not the older
// "prisma-client-js") has no built-in query engine — it requires an
// explicit driver adapter. For Postgres that's @prisma/adapter-pg wrapping
// a plain `pg` Pool.
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Matches the R&D kit's connection details (director-applicant-search-rd-kit):
// port 5434, db director_applicant_rd. Override via DATABASE_URL in .env
// if this differs from your setup.
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5434/director_applicant_rd";

function createPrismaClient() {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}