// src/services/admin/index.ts
import { campaignsService } from "./campaigns-service";
import { dashboardService } from "./dashboard-service";
import { organizationsService } from "./organizations-service";

export const adminService = {
  dashboard: dashboardService,
  organizations: organizationsService,
  campaigns: campaignsService,
};
