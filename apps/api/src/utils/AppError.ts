export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);

    // Restore prototype chain (needed when extending built-ins in TypeScript)
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string): AppError {
    return new AppError(message, 400);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, 404);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, false);
  }
}
