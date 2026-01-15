/**
 * Centralized Error Handler
 * Provides user-friendly error messages for production and logs technical details
 */

interface ErrorPattern {
  pattern: RegExp | string;
  message: string;
}

// Map of error patterns to user-friendly messages
const errorPatterns: ErrorPattern[] = [
  // Permission errors
  { pattern: /permission|forbidden|403|insufficient permissions/i, message: "You don't have permission to perform this action. Please contact your administrator." },
  { pattern: /superadmin required|admin required/i, message: "This action requires administrator privileges. Please contact your administrator." },
  
  // Authentication errors
  { pattern: /unauthorized|401|invalid.*token|expired.*token|jwt/i, message: "Your session has expired. Please log in again." },
  { pattern: /not authenticated|login required/i, message: "Please log in to continue." },
  
  // Row Level Security (RLS) errors
  { pattern: /row.*level.*security|rls|policy.*violation|violates.*policy/i, message: "Access denied. You may not have permission to access this data." },
  { pattern: /new row violates row-level security/i, message: "You don't have permission to create this record. Please contact your administrator." },
  
  // Network errors
  { pattern: /network.*error|failed to fetch|fetch.*failed|connection.*refused/i, message: "Unable to connect. Please check your internet connection and try again." },
  { pattern: /timeout|timed out/i, message: "The request took too long. Please try again." },
  
  // Edge function errors
  { pattern: /edge.*function|function.*invoke|functionsrelayclient/i, message: "Something went wrong. Please try again or contact support if the issue persists." },
  { pattern: /internal server error|500/i, message: "Something went wrong on our end. Please try again later." },
  
  // Database errors
  { pattern: /duplicate.*key|unique.*constraint|already exists/i, message: "This record already exists. Please use a different value." },
  { pattern: /foreign.*key|reference.*constraint/i, message: "This record is linked to other data and cannot be modified." },
  { pattern: /not.*found|no.*rows/i, message: "The requested item was not found." },
  
  // Validation errors
  { pattern: /validation|invalid.*input|required.*field/i, message: "Please check your input and try again." },
  
  // Rate limiting
  { pattern: /rate.*limit|too.*many.*requests|429/i, message: "Too many requests. Please wait a moment and try again." },
];

/**
 * Get a user-friendly error message from any error
 * @param error - The error object or message
 * @returns User-friendly error message
 */
export function getDisplayErrorMessage(error: unknown): string {
  // Default fallback message
  const defaultMessage = "Something went wrong. Please try again or contact support if the issue persists.";
  
  if (!error) return defaultMessage;
  
  // Extract error message from various error formats
  let errorMessage = "";
  
  if (typeof error === "string") {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "object") {
    const errorObj = error as Record<string, unknown>;
    errorMessage = 
      (errorObj.message as string) || 
      (errorObj.error as string) || 
      (errorObj.msg as string) ||
      (errorObj.details as string) ||
      JSON.stringify(error);
  }
  
  // Check against patterns
  for (const { pattern, message } of errorPatterns) {
    if (typeof pattern === "string") {
      if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
        return message;
      }
    } else if (pattern.test(errorMessage)) {
      return message;
    }
  }
  
  return defaultMessage;
}

/**
 * Log error details to console for debugging
 * @param error - The error object
 * @param context - Context about where the error occurred
 */
export function logError(error: unknown, context: string): void {
  const timestamp = new Date().toISOString();
  
  console.error(`[${timestamp}] Error in ${context}:`, {
    error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

/**
 * Handle an error with both logging and user-friendly message
 * @param error - The error object
 * @param context - Context about where the error occurred
 * @returns User-friendly error message
 */
export function handleError(error: unknown, context: string): string {
  logError(error, context);
  return getDisplayErrorMessage(error);
}

/**
 * Check if error is a permission/authorization error
 */
export function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /permission|forbidden|403|insufficient|superadmin|admin required/i.test(message);
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unauthorized|401|invalid.*token|expired.*token|not authenticated/i.test(message);
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network.*error|failed to fetch|connection.*refused|timeout/i.test(message);
}
