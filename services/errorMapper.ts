import { PostgrestError } from '@supabase/supabase-js';

export interface AppError {
  message: string;
  code: string;
  originalError?: any;
}

export const mapSupabaseError = (error: any): AppError => {
  // Handle specific Postgres error codes
  if (error?.code === '42P01') {
    return {
      message: "Database Error: Table not found. Please run the SQL schema script.",
      code: 'TABLE_NOT_FOUND',
      originalError: error
    };
  }

  if (error?.code === '23505') {
    return {
      message: "This record already exists.",
      code: 'DUPLICATE_ENTRY',
      originalError: error
    };
  }

  if (error?.code === 'PGRST116') {
    return {
      message: "No data found.",
      code: 'NO_DATA_FOUND',
      originalError: error
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      originalError: error
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'UNKNOWN_ERROR',
      originalError: error
    };
  }

  // Fallback
  return {
    message: error?.message || error?.error_description || "An unexpected error occurred",
    code: error?.code || 'UNKNOWN_ERROR',
    originalError: error
  };
};

export const isTableNotFoundError = (error: any): boolean => {
  return error?.code === '42P01' || error?.code === 'TABLE_NOT_FOUND';
};
