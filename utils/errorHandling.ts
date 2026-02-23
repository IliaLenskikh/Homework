export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    if (error.code === '42P01') return "Database Error: Table not found. Please run the SQL schema script.";
    if (error.message) return error.message;
    if (error.error_description) return error.error_description;
    return JSON.stringify(error);
  }
  return String(error);
};
