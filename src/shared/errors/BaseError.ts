/**
 * 기본 에러 클래스
 *
 * Main, Renderer에서 공통으로 사용할 커스텀 에러 정의.
 * 모든 앱 에러는 이를 상속해야 함.
 */

import { ERROR_CODES, type ErrorCode } from '../constants';

export class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.UNKNOWN,
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date();
    if (context !== undefined) {
      this.context = context;
    }

    // 프로토타입 체인 설정 (instanceof 작동)
    Object.setPrototypeOf(this, BaseError.prototype);

    // Stack trace 캡처
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 에러를 JSON으로 직렬화
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
    };
  }

  /**
   * 에러를 IPC 응답으로 변환
   */
  toIpcError() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}
