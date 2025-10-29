/**
 * 앱 도메인 에러 클래스들
 *
 * BaseError를 상속해서 구체적인 에러 타입 정의.
 * Main/Renderer에서 특정 상황에 맞게 throw/catch 가능.
 */

import { BaseError } from './BaseError';
import { ERROR_CODES, type ErrorCode } from '../constants';
import type { SerializableRecord } from '../types/constraints';

/**
 * 유효성 검사 실패
 */
export class ValidationError extends BaseError {
  constructor(message: string, context?: SerializableRecord, cause?: Error) {
    super(message, ERROR_CODES.VALIDATION_INVALID_FORMAT, 400, context, cause);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * IPC 채널 에러
 */
export class IpcChannelError extends BaseError {
  constructor(message: string, context?: SerializableRecord, cause?: Error) {
    super(message, ERROR_CODES.IPC_CHANNEL_INVALID, 400, context, cause);
    Object.setPrototypeOf(this, IpcChannelError.prototype);
  }
}

/**
 * 파일 시스템 에러
 */
export class FileError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.FILE_READ_ERROR,
    context?: SerializableRecord,
    cause?: Error
  ) {
    super(message, code, 500, context, cause);
    Object.setPrototypeOf(this, FileError.prototype);
  }
}

/**
 * 네트워크 에러
 */
export class NetworkError extends BaseError {
  constructor(message: string, context?: SerializableRecord, cause?: Error) {
    super(message, ERROR_CODES.NETWORK_CONNECTION_FAILED, 503, context, cause);
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * 데이터베이스 에러
 */
export class DatabaseError extends BaseError {
  constructor(message: string, context?: SerializableRecord, cause?: Error) {
    super(message, ERROR_CODES.DB_QUERY_ERROR, 500, context, cause);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * 타임아웃 에러
 */
export class TimeoutError extends BaseError {
  constructor(message: string, context?: SerializableRecord, cause?: Error) {
    super(message, ERROR_CODES.IPC_TIMEOUT_30S, 504, context, cause);
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * 리소스 미존재 에러
 */
export class NotFoundError extends BaseError {
  constructor(message: string, context?: SerializableRecord, cause?: Error) {
    super(message, ERROR_CODES.DB_NOT_FOUND, 404, context, cause);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Electron 윈도우 에러
 */
export class WindowError extends BaseError {
  constructor(message: string, context?: SerializableRecord, cause?: Error) {
    super(message, ERROR_CODES.WINDOW_NOT_FOUND, 400, context, cause);
    Object.setPrototypeOf(this, WindowError.prototype);
  }
}
