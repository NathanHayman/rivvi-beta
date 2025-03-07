// src/types/api/auth.ts
export interface AuthContext {
    userId: string | null;
    orgId: string | null;
    isSuperAdmin: boolean;
  }
  
  export interface UserProfile {
    id: string;
    clerkId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    orgId?: string;
    createdAt: Date;
    updatedAt?: Date;
  }
  
  export interface OrgProfile {
    id: string;
    clerkId: string;
    name: string;
    phone?: string;
    timezone: string;
    officeHours?: Record<string, any>;
    concurrentCallLimit: number;
    isSuperAdmin: boolean;
    createdAt: Date;
    updatedAt?: Date;
  }