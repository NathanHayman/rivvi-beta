// src/types/api/organizations.ts
export interface Organization {
  id: string;
  clerkId: string;
  name: string;
  phone?: string;
  timezone: string;
  officeHours?: {
    monday: { start: string; end: string };
    tuesday: { start: string; end: string };
    wednesday: { start: string; end: string };
    thursday: { start: string; end: string };
    friday: { start: string; end: string };
    saturday?: { start: string; end: string } | null;
    sunday?: { start: string; end: string } | null;
  };
  concurrentCallLimit: number;
  isSuperAdmin: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface OrganizationMember {
  id: string;
  clerkId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface UpdateOrganizationInput {
  id: string;
  name?: string;
  phone?: string;
  timezone?: string;
  officeHours?: Record<string, any>;
  concurrentCallLimit?: number;
}

export interface GetOrganizationMembersOptions {
  organizationId?: string;
  limit?: number;
  offset?: number;
}
