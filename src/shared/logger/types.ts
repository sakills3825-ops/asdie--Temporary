/**
 * Logger 인터페이스 정의
 *
 * Main/Renderer 프로세스에서 구현할 Logger의 공통 인터페이스.
 * 각 프로세스에서 독립적으로 구현 가능.
 */

import { LogLevel } from './levels';

export type { LogFields, LogErrorInfo } from './fields';
export { LogLevel } from './levels';

/**
 * Logger API에 전달되는 컨텍스트 (사용자 입력)
 *
 * 내부적으로 LogFields로 변환되어 저장됨.
 * 사용자가 로그 시 전달하는 간단한 객체.
 *
 * @example
 * logger.info('User login', {
 *   processType: 'main',
 *   module: 'AuthService',
 *   userId: 'user-123',
 *   metadata: { ip: '192.168.1.1' }
 * });
 */
export interface LogContext {
  processType?: 'main' | 'renderer';
  module?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  /**
   * 추가 메타데이터 (구조화된 로깅)
   */
  metadata?: Record<string, unknown>;
}

/**
 * Logger 인터페이스
 *
 * 6개 로그 레벨 지원:
 * - trace(): 가장 상세한 정보
 * - debug(): 개발 중 디버깅용
 * - info(): 일반 정보성
 * - warn(): 경고 (비정상이지만 계속 실행)
 * - error(): 에러 (작업 실패)
 * - fatal(): 심각한 에러 (시스템 종료 필요)
 */
export interface ILogger {
  /**
   * 추적 레벨 로그 (변수값, 함수흐름, 루프 반복 등)
   */
  trace(message: string, context?: LogContext): void;

  /**
   * 디버그 레벨 로그
   */
  debug(message: string, context?: LogContext): void;

  /**
   * 정보 레벨 로그
   */
  info(message: string, context?: LogContext): void;

  /**
   * 경고 레벨 로그
   */
  warn(message: string, context?: LogContext): void;

  /**
   * 에러 레벨 로그
   *
   * 오버로드:
   * - error(message: string, context?: LogContext)
   * - error(message: string, error: Error, context?: LogContext)
   *
   * @example
   * logger.error('Operation failed');
   * logger.error('File read failed', new Error('ENOENT'), { module: 'FileService' });
   */
  error(message: string, context?: LogContext): void;
  error(message: string, error: Error, context?: LogContext): void;

  /**
   * 심각한 에러 레벨 로그 (시스템 종료 필요)
   *
   * @example
   * logger.fatal('Database connection lost - shutting down');
   */
  fatal(message: string, context?: LogContext): void;
  fatal(message: string, error: Error, context?: LogContext): void;

  /**
   * 현재 로그 레벨 설정
   */
  setLevel(level: LogLevel): void;

  /**
   * 현재 로그 레벨 조회
   */
  getLevel(): LogLevel;

  /**
   * 로거 종료 (리소스 정리, 파일 닫기 등)
   */
  close?(): Promise<void>;
}

export interface LoggerConfig {
  level?: LogLevel;
  format?: 'json' | 'text';
  logDir?: string;
  maxSize?: number; // 파일 크기 제한 (bytes)
  maxFiles?: number; // 보관할 최대 로그 파일 수
  processType?: 'main' | 'renderer';
}
