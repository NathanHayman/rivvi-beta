// src/server/api/root.ts
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import {
  adminRouter,
  callRouter,
  campaignRouter,
  dashboardRouter,
  organizationRouter,
  patientRouter,
  runRouter,
} from "./routers";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  campaign: campaignRouter,
  run: runRouter,
  patient: patientRouter,
  call: callRouter,
  admin: adminRouter,
  dashboard: dashboardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
