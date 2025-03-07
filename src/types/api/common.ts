// src/types/api/common.ts
export type PaginationParams = {
    limit?: number;
    offset?: number;
  };
  
  export type SortParams = {
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  };
  
  export type PaginatedResponse<T> = {
    data: T[];
    totalCount: number;
    hasMore: boolean;
  };
  
  export type ApiErrorResponse = {
    code: string;
    message: string;
    details?: any;
  };