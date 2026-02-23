import { mapSupabaseError } from '../services/errorMapper';

export const getErrorMessage = (error: any): string => {
  const appError = mapSupabaseError(error);
  return appError.message;
};
