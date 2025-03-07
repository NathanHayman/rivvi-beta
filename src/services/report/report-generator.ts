// src/services/report/report-generator.ts
import { createError, createSuccess, ServiceResult } from "@/lib/service-result";
import { calls, campaigns, patients, runs } from "@/server/db/schema";
import { format } from "date-fns";
import { and, desc, eq, gte, lte, SQLWrapper } from "drizzle-orm";
import Papa from "papaparse";

export type ReportType = "calls" | "campaigns" | "runs" | "patients";
export type ReportFormat = "csv" | "json";

export interface ReportOptions {
  orgId: string;
  reportType: ReportType;
  startDate?: Date;
  endDate?: Date;
  campaignId?: string;
  runId?: string;
  format: ReportFormat;
}

export class ReportGenerator {
  private db;
  
  constructor(db) {
    this.db = db;
  }
  
  /**
   * Generate a report based on options
   */
  async generateReport(options: ReportOptions): Promise<ServiceResult<{
    data: string;
    filename: string;
    contentType: string;
  }>> {
    try {
      // Get the appropriate data based on report type
      const data = await this.getReportData(options);
      
      // Format the data
      const formattedData = this.formatData(data, options.format);
      
      // Generate filename
      const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
      const filename = `${options.reportType}_report_${timestamp}.${options.format}`;
      
      // Content type based on format
      const contentType = options.format === "csv" 
        ? "text/csv" 
        : "application/json";
      
      return createSuccess({
        data: formattedData,
        filename,
        contentType,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      return createError("INTERNAL_ERROR", "Failed to generate report", error);
    }
  }
  
  /**
   * Get data based on report type and filters
   */
  private async getReportData(options: ReportOptions): Promise<any[]> {
    const { orgId, reportType, startDate, endDate, campaignId, runId } = options;
    
    // Base date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = and(
        gte(calls.createdAt, startDate),
        lte(calls.createdAt, endDate)
      );
    } else if (startDate) {
      dateFilter = gte(calls.createdAt, startDate);
    } else if (endDate) {
      dateFilter = lte(calls.createdAt, endDate);
    }
    
    switch (reportType) {
      case "calls": {
        // Get calls with filters
        let filters = and(eq(calls.orgId, orgId), dateFilter as SQLWrapper);
        
        if (campaignId) {
          filters = and(filters, eq(calls.campaignId, campaignId));
        }
        
        if (runId) {
          filters = and(filters, eq(calls.runId, runId));
        }
        
        const callsData = await this.db
          .select({
            id: calls.id,
            direction: calls.direction,
            status: calls.status,
            fromNumber: calls.fromNumber,
            toNumber: calls.toNumber,
            duration: calls.duration,
            patientId: calls.patientId,
            campaignName: campaigns.name,
            startTime: calls.startTime,
            endTime: calls.endTime,
            createdAt: calls.createdAt,
            analysis: calls.analysis,
          })
          .from(calls)
          .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
          .where(filters)
          .orderBy(desc(calls.createdAt));
          
        // Process data to flatten analysis fields for CSV
        return callsData.map(call => {
          const flatData = {
            ...call,
            analysis: undefined,
          };
          
          // Add analysis fields as top-level properties
          if (call.analysis) {
            Object.entries(call.analysis).forEach(([key, value]) => {
              if (typeof value !== 'object') {
                flatData[`analysis_${key}`] = value;
              }
            });
          }
          
          return flatData;
        });
      }
      
      case "campaigns": {
        // Get campaigns with stats
        const campaignsData = await this.db
          .select({
            id: campaigns.id,
            name: campaigns.name,
            direction: campaigns.direction,
            isActive: campaigns.isActive,
            createdAt: campaigns.createdAt,
            totalCalls: this.db.fn.count(calls.id).as('totalCalls'),
            completedCalls: this.db.fn.count(
              and(eq(calls.status, 'completed'))
            ).as('completedCalls'),
            failedCalls: this.db.fn.count(
              and(eq(calls.status, 'failed'))
            ).as('failedCalls'),
          })
          .from(campaigns)
          .leftJoin(calls, eq(calls.campaignId, campaigns.id))
          .where(eq(campaigns.orgId, orgId))
          .groupBy(campaigns.id)
          .orderBy(desc(campaigns.createdAt));
          
        return campaignsData;
      }
      
      case "runs": {
        // Get runs with stats
        let filters = eq(runs.orgId, orgId);
        
        if (campaignId) {
          filters = and(filters, eq(runs.campaignId, campaignId));
        }
        
        const runsData = await this.db
          .select({
            id: runs.id,
            name: runs.name,
            status: runs.status,
            campaignName: campaigns.name,
            createdAt: runs.createdAt,
            totalCalls: this.db.fn.count(calls.id).as('totalCalls'),
            completedCalls: this.db.fn.count(
              and(eq(calls.status, 'completed'))
            ).as('completedCalls'),
            metadata: runs.metadata,
          })
          .from(runs)
          .leftJoin(campaigns, eq(runs.campaignId, campaigns.id))
          .leftJoin(calls, eq(calls.runId, runs.id))
          .where(filters)
          .groupBy(runs.id, campaigns.name)
          .orderBy(desc(runs.createdAt));
          
        // Process data to flatten metadata fields for CSV
        return runsData.map(run => {
          const flatData = {
            ...run,
            metadata: undefined,
          };
          
          // Add relevant metadata as top-level properties
          if (run.metadata?.rows) {
            flatData.totalRows = run.metadata.rows.total;
            flatData.invalidRows = run.metadata.rows.invalid;
          }
          
          if (run.metadata?.calls) {
            flatData.totalCallsPlanned = run.metadata.calls.total;
            flatData.pendingCalls = run.metadata.calls.pending;
            flatData.voicemailCalls = run.metadata.calls.voicemail;
          }
          
          if (run.metadata?.run) {
            flatData.startTime = run.metadata.run.startTime;
            flatData.endTime = run.metadata.run.endTime;
            flatData.runDuration = run.metadata.run.duration;
          }
          
          return flatData;
        });
      }
      
      case "patients": {
        // Get patients with call stats
        const patientsData = await this.db
          .select({
            id: patients.id,
            firstName: patients.firstName,
            lastName: patients.lastName,
            primaryPhone: patients.primaryPhone,
            secondaryPhone: patients.secondaryPhone,
            dob: patients.dob,
            isMinor: patients.isMinor,
            createdAt: patients.createdAt,
            totalCalls: this.db.fn.count(calls.id).as('totalCalls'),
            lastCallDate: this.db.fn.max(calls.createdAt).as('lastCallDate'),
          })
          .from(patients)
          .innerJoin(
            calls,
            and(
              eq(patients.id, calls.patientId),
              eq(calls.orgId, orgId)
            )
          )
          .groupBy(patients.id)
          .orderBy(desc(this.db.fn.max(calls.createdAt)));
          
        return patientsData;
      }
      
      default:
        return [];
    }
  }
  
  /**
   * Format data based on chosen format
   */
  private formatData(data: any[], format: ReportFormat): string {
    if (format === "csv") {
      // Convert to CSV with Papa Parse
      return Papa.unparse(data, {
        header: true,
        skipEmptyLines: true,
      });
    } else {
      // Convert to formatted JSON
      return JSON.stringify(data, null, 2);
    }
  }
}