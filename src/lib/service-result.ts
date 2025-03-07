// src/lib/service-result.ts
export type ServiceResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code: ErrorCode;
        message: string;
        details?: any;
      };
    };

export type ErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "VALIDATION_ERROR";

// Type guard functions to help TypeScript narrow the types correctly
export function isSuccess<T>(
  result: ServiceResult<T>,
): result is { success: true; data: T } {
  return result.success === true;
}

export function isError<T>(result: ServiceResult<T>): result is {
  success: false;
  error: { code: ErrorCode; message: string; details?: any };
} {
  return result.success === false;
}

export function createSuccess<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function createError<T>(
  code: ErrorCode,
  message: string,
  details?: any,
): ServiceResult<T> {
  // Log error details in development
  if (process.env.NODE_ENV === "development" && details) {
    console.error(`[Service Error] ${code}: ${message}`, details);
  }

  return {
    success: false,
    error: {
      code,
      message,
      details: process.env.NODE_ENV === "development" ? details : undefined,
    },
  };
}

// Helper to handle common error patterns
export function handleServiceError(error: unknown): ServiceResult<never> {
  console.error("Service error:", error);

  if (error instanceof Error) {
    return createError("INTERNAL_ERROR", error.message, error);
  }

  return createError("INTERNAL_ERROR", "An unexpected error occurred", error);
}
