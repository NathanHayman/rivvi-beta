import { relations } from "drizzle-orm";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";
import { campaignRequests, organizations, users } from "./schema";

/**
 * Define relations for campaign requests
 */
export const campaignRequestsRelations = relations(
  campaignRequests,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [campaignRequests.orgId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [campaignRequests.requestedBy],
      references: [users.id],
    }),
  }),
);

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema }) as PostgresJsDatabase<
  typeof schema
>;
