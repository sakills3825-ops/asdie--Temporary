/**
 * Logger 필드 정의 (구조화된 로깅)
 *
 * 프로덕션급 로깅을 위한 구조화된 필드 세트.
 * JSON 직렬화 가능 하도록 설계됨.
 */

import { LogLevel } from './levels';

/**
 * 구조화된 로그 필드
 *
 * 자동 수집 필드 (Logger 구현에서 자동으로 채움):
 * - timestamp: ISO8601 형식
 * - file: 소스파일 (__filename)
 * - line: 라인번호 (__line)
 * - function: 함수명
 * - stack: 스택 트레이스 (Error 발생 시)
 *
 * @example
 * {
 *   timestamp: '2025-10-27T12:34:56.789Z',
 *   level: 'error',
 *   message: 'File read failed',
 *   file: '/src/main/services/fileService.ts',
 *   line: 42,
 *   function: 'readFile',
 *   processType: 'main',
 *   module: 'FileService',
 *   userId: 'user-123',
 *   sessionId: 'sess-abc',
 *   requestId: 'req-xyz',
 *   duration: 1500,
 *   error: {
 *     message: 'ENOENT: no such file or directory',
 *     code: 'E_ZEN_FILE_NOT_FOUND',
 *     name: 'Error',
 *     stack: '...'
 *   },
 *   metadata: {
 *     filePath: '/tmp/file.txt',
 *     retries: 3,
 *     timeout: 5000
 *   }
 * }
 */
export interface LogFields {
  /** ISO8601 타임스탐프 (자동 수집) */
  timestamp: string;

  /** 로그 레벨 */
  level: LogLevel;

  /** 로그 메시지 */
  message: string;

  /** 소스 파일명 (자동 수집) */
  file?: string;

  /** 소스 라인번호 (자동 수집) */
  line?: number;

  /** 함수명 (자동 수집) */
  function?: string;

  /** 스택 트레이스 (자동 수집, Error 발생 시) */
  stack?: string;

  /** 프로세스 타입 */
  processType?: 'main' | 'renderer';

  /** 모듈명 (Namespace) */
  module?: string;

  /** 사용자 ID (추적용) */
  userId?: string;

  /** 세션 ID (추적용) */
  sessionId?: string;

  /** 요청 ID (분산추적용) */
  requestId?: string;

  /** 작업 소요시간 (milliseconds) */
  duration?: number;

  /** 에러 정보 (Error 발생 시) */
  error?: LogErrorInfo;

  /** 추가 메타데이터 (구조화된 로깅) */
  metadata?: Record<string, unknown>;
}

/**
 * 에러 정보 (LogFields.error)
 */
export interface LogErrorInfo {
  /** 에러 메시지 */
  message: string;

  /** 에러 코드 (E_ZEN_*) */
  code?: string;

  /** 에러 이름 (Error.name) */
  name?: string;

  /** 에러 스택 트레이스 */
  stack?: string;

  /** 추가 에러 정보 */
  cause?: unknown;
}

/**
 * 로그 필드 빌더 (Fluent API)
 *
 * @example
 * const fields = new LogFieldsBuilder('browserNavigateTo')
 *   .setLevel('error')
 *   .setModule('NavigationService')
 *   .setError(error)
 *   .setDuration(1500)
 *   .setMetadata({ url: 'https://example.com' })
 *   .build();
 */
export class LogFieldsBuilder {
  private fields: LogFields;

  constructor(message: string) {
    this.fields = {
      timestamp: new Date().toISOString(),
      level: 'info' as LogLevel,
      message,
    };
  }

  setLevel(level: LogLevel): this {
    this.fields.level = level;
    return this;
  }

  setFile(file?: string): this {
    if (file) this.fields.file = file;
    return this;
  }

  setLine(line?: number): this {
    if (line !== undefined) this.fields.line = line;
    return this;
  }

  setFunction(func?: string): this {
    if (func) this.fields.function = func;
    return this;
  }

  setStack(stack?: string): this {
    if (stack) this.fields.stack = stack;
    return this;
  }

  setProcessType(type: 'main' | 'renderer'): this {
    this.fields.processType = type;
    return this;
  }

  setModule(module: string): this {
    this.fields.module = module;
    return this;
  }

  setUserId(userId: string): this {
    this.fields.userId = userId;
    return this;
  }

  setSessionId(sessionId: string): this {
    this.fields.sessionId = sessionId;
    return this;
  }

  setRequestId(requestId: string): this {
    this.fields.requestId = requestId;
    return this;
  }

  setDuration(duration: number): this {
    this.fields.duration = duration;
    return this;
  }

  setError(error: Error | LogErrorInfo): this {
    if (error instanceof Error) {
      const cause = 'cause' in error ? error.cause : undefined;
      this.fields.error = {
        message: error.message,
        name: error.name,
        stack: error.stack || '',
        cause,
      };
    } else {
      this.fields.error = error;
    }
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.fields.metadata = metadata;
    return this;
  }

  build(): LogFields {
    return { ...this.fields };
  }
}

/**
 * LogFields를 JSON 문자열로 변환
 *
 * 순환 참조 방지 및 정렬된 키로 일관성 있는 출력
 */
export function serializeLogFields(fields: LogFields): string {
  try {
    return JSON.stringify(fields, null, 0);
  } catch {
    // 순환 참조 등의 직렬화 오류 처리
    return JSON.stringify({
      timestamp: fields.timestamp,
      level: fields.level,
      message: fields.message,
      error: 'Failed to serialize log fields',
    });
  }
}

/**
 * LogFields를 읽기 쉬운 문자열로 변환 (콘솔 출력용)
 *
 * @example
 * // "[2025-10-27T12:34:56.789Z] ERROR [NavigationService] browserNavigateTo failed"
 */
export function formatLogFields(fields: LogFields): string {
  const parts: string[] = [];

  // Timestamp
  parts.push(`[${fields.timestamp}]`);

  // Level (대문자)
  parts.push(fields.level.toUpperCase().padEnd(5));

  // Module
  if (fields.module) {
    parts.push(`[${fields.module}]`);
  }

  // Message
  parts.push(fields.message);

  // Duration
  if (fields.duration !== undefined) {
    parts.push(`(${fields.duration}ms)`);
  }

  // Error info
  if (fields.error) {
    parts.push(`Error: ${fields.error.message}`);
    if (fields.error.code) {
      parts.push(`Code: ${fields.error.code}`);
    }
  }

  return parts.join(' ');
}
