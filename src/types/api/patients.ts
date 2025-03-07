// src/types/api/patients.ts
export type Patient = {
    id: string;
    patientHash: string;
    secondaryHash?: string;
    normalizedPhone?: string;
    firstName: string;
    lastName: string;
    dob: string;
    isMinor: boolean;
    primaryPhone: string;
    secondaryPhone?: string;
    externalIds?: Record<string, string>;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt?: string;
  };
  
  export type PatientWithMetadata = Patient & {
    emrIdInOrg?: string;
    callCount?: number;
    lastCall?: any;
  };
  
  export type PatientSearchOptions = {
    limit?: number;
    offset?: number;
    search?: string;
    orgId: string;
  };
  
  export type CreatePatientInput = {
    firstName: string;
    lastName: string;
    dob: string;
    primaryPhone: string;
    secondaryPhone?: string;
    emrIdInOrg?: string;
  };
  
  export type UpdatePatientInput = {
    id: string;
    firstName?: string;
    lastName?: string;
    primaryPhone?: string;
    secondaryPhone?: string;
    emrIdInOrg?: string;
  };