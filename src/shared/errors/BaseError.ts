/**
 * 기본 에러 클래스
 *
 * Main, Renderer에서 공통으로 사용할 커스텀 에러 정의.
 * 모든 앱 에러는 이를 상속해야 함.
 */

import { ERROR_CODES, type ErrorCode } from '../constants';
import type { SerializableRecord } from '../types/constraints';

export class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly timestamp: Date;
  public readonly context?: SerializableRecord; // 직렬화 가능한 타입만
  public readonly cause?: Error; // ES2022: 에러 체인 지원

  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.UNKNOWN,
    statusCode: number = 500,
    context?: SerializableRecord,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date();
    if (context !== undefined) {
      this.context = context;
    }
    if (cause !== undefined) {
      this.cause = cause;
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
   * 
   * IPC 전송, 로깅, 외부 API 응답 등에 사용.
   * Stack trace와 cause를 포함하여 디버깅 정보 보존.
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack, // Stack trace 포함
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }

  /**
   * 클라이언트에 안전하게 노출할 에러 정보
   * 
   * 민감한 정보(context, stack trace)를 제거한 버전.
   * Renderer나 외부 API에 전달할 때 사용.
   */
  toClientResponse() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      // context, stack, cause 제외 (보안)
    };
  }

  /**
   * 내부 로깅용 전체 정보
   * 
   * Main process 로그, 디버깅, 에러 추적에 사용.
   * 모든 정보 포함.
   */
  toInternalLog() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }
}
