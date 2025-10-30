/**
 * BaseHandler - 모든 IPC 핸들러의 기반 클래스
 *
 * 책임:
 * - 공통 에러 처리 (formatErrorResponse)
 * - 공통 로깅 설정
 * - 공통 응답 포맷
 *
 * 이점:
 * - 코드 중복 제거 (DRY)
 * - 일관된 에러 처리
 * - 유지보수 용이성 향상
 */

import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';
import type { BaseError } from '../../shared/errors';

/**
 * IPC 응답 포맷 (공통)
 */
export type IpcSuccessResponse<T = void> = { success: true; data: T | undefined };
export type IpcErrorResponse = { success: false; error: string };
export type IpcResponse<T = void> = IpcSuccessResponse<T> | IpcErrorResponse;

/**
 * 기반 핸들러 클래스
 */
export abstract class BaseHandler {
  protected logger: ILogger;
  protected handlerName: string;

  constructor(handlerName: string) {
    this.handlerName = handlerName;
    this.logger = new LoggerImpl(handlerName, LogLevel.INFO);
  }

  /**
   * 에러 응답 생성 헬퍼
   * BaseError 타입 감지 및 로깅
   *
   * 사용:
   * ```typescript
   * try {
   *   const result = await this.service.doSomething();
   *   return { success: true, data: result };
   * } catch (error) {
   *   return this.formatErrorResponse(error, 'Doing something');
   * }
   * ```
   */
  protected formatErrorResponse(error: unknown, operation: string): IpcErrorResponse {
    // BaseError 구조 감지 (instanceof 대신 구조 기반)
    if (error instanceof Error && 'code' in error && 'statusCode' in error) {
      const baseErr = error as BaseError;
      this.logger.error(`${this.handlerName}: ${operation} failed`, baseErr);
      return { success: false, error: baseErr.message };
    }

    // 일반 Error
    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.error(`${this.handlerName}: ${operation} failed`, err);
    return { success: false, error: err.message };
  }

  /**
   * 성공 응답 생성 헬퍼
   */
  protected createSuccessResponse<T>(data?: T): IpcSuccessResponse<T> {
    return { success: true, data };
  }

  /**
   * 에러 응답 생성 헬퍼 (직접 호출용)
   */
  protected createErrorResponse(message: string): IpcErrorResponse {
    return { success: false, error: message };
  }

  /**
   * 로그 기록 헬퍼 (일관된 포맷)
   */
  protected logOperation(operation: string, metadata?: Record<string, unknown>): void {
    this.logger.info(`${operation}`, {
      module: this.handlerName,
      ...metadata,
    });
  }
}
