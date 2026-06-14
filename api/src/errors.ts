/**
 * Application error carrying an HTTP status code.
 * Controllers map `statusCode` to the response status; anything without one
 * falls through to the global 500 handler.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}
