/**
 * Express 에러 처리를 위한 기본 커스텀 에러 클래스.
 *
 * @remarks
 * 모든 operational error는 이 클래스를 상속받아 사용한다.
 * isOperational이 true면 예상된 에러로 사용자에게 메시지를 전달하고,
 * false면 프로그래머 에러로 Internal Server Error를 응답한다.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly data?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    data?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.data = data;

    // TypeScript에서 Error를 상속할 때 prototype chain이 깨지는 문제 방지
    Object.setPrototypeOf(this, new.target.prototype);

    // 이 생성자 호출을 stack trace에서 제외
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 Bad Request */
export class BadRequestError extends AppError {
  constructor(message = "Bad request", data?: Record<string, unknown>) {
    super(message, 400, true, data);
  }
}

/** 401 Unauthorized */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

/** 403 Forbidden */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

/** 404 Not Found */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

/** 409 Conflict */
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

/** 429 Too Many Requests */
export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests", data?: Record<string, unknown>) {
    super(message, 429, true, data);
  }
}

/** Zod 등 검증 실패 에러. */
export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400);
  }
}

/** 외부 API (Tuno AI, LS증권 등) 호출 실패 에러. */
export class ExternalApiError extends AppError {
  public readonly source: "TUNO_AI" | "LS_SECURITIES";

  constructor(
    source: "TUNO_AI" | "LS_SECURITIES",
    statusCode: number,
    message: string,
    data?: Record<string, unknown>
  ) {
    super(message, statusCode, true, data);
    this.source = source;
  }
}
