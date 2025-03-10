"use server";

import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

/**
 * Run a SQL migration file directly
 */
export async function runSqlMigration(migrationName: string) {
  try {
    // Read the migration file
    const migrationPath = path.join(
      process.cwd(),
      "drizzle",
      "migrations",
      migrationName,
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    // Execute the SQL
    await db.execute(sql.raw(migrationSql));

    return {
      success: true,
      message: `Migration ${migrationName} executed successfully`,
    };
  } catch (error) {
    console.error("Error running migration:", error);
    return {
      success: false,
      message: `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
