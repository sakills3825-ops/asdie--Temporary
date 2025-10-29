/**
 * Logger 구현
 *
 * Main/Renderer 프로세스에서 사용할 수 있는 ILogger 인터페이스 구현.
 * 구조화된 로깅 + 파일/콘솔 출력 지원.
 *
 * @example
 * const logger = new LoggerImpl('MainLogger', LogLevel.DEBUG);
 * logger.info('App started', { module: 'Main' });
 * logger.error('File read failed', error, { module: 'FileService' });
 */

import { ILogger, LogContext, LoggerConfig } from './types';
import { LogLevel, shouldLog, LOG_LEVEL_COLORS, RESET_COLOR } from './levels';
import { LogFields, LogFieldsBuilder, formatLogFields } from './fields';

/**
 * Logger 구현체
 *
 * - 6단계 로그 레벨 지원
 * - 구조화된 로깅 (JSON 형식)
 * - 콘솔 출력 (컬러 포함)
 * - 스택 트레이스 자동 수집
 * - 성능 최적화: 정규식 캐싱, 스택 트레이스 캐싱
 */
export class LoggerImpl implements ILogger {
  private readonly loggerName: string;
  private currentLevel: LogLevel;
  private processType: 'main' | 'renderer';
  private outputs: ((fields: LogFields) => void)[] = [];

  // 성능 최적화: 정규식 미리 컴파일
  private static readonly FILE_REGEX = /\((.+?):(\d+):(\d+)\)/;
  private static readonly LINE_REGEX = /:(\d+):/;
  private static readonly FUNCTION_REGEX = /at\s+([a-zA-Z0-9_$.<>]+)/;

  // 성능 최적화: 스택 트레이스 캐싱 (호출자별)
  // 키: 스택 라인 문자열, 값: { file, line, function }
  private readonly stackCache = new Map<string, { file?: string; line?: number; fn?: string }>();
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * Logger 생성
   *
   * @param name - 로거 이름 (구분용, 예: 'MainLogger', 'RendererLogger')
   * @param level - 기본 로그 레벨 (기본값: INFO)
   * @param config - 추가 설정
   */
  constructor(
    name: string,
    level: LogLevel = LogLevel.INFO,
    config?: LoggerConfig
  ) {
    this.loggerName = name;
    this.currentLevel = level;
    this.processType = config?.processType || 'main';

    // 기본 출력: 콘솔
    this.addConsoleOutput();

    // 파일 출력 설정 (필요시 활성화)
    // if (config?.logDir) {
    //   this.addFileOutput(config.logDir);
    // }
  }

  /**
   * 추적 레벨 로그
   */
  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, undefined, context);
  }

  /**
   * 디버그 레벨 로그
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  /**
   * 정보 레벨 로그
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  /**
   * 경고 레벨 로그
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  /**
   * 에러 레벨 로그 (오버로드)
   */
  error(message: string, contextOrError?: LogContext | Error, context?: LogContext): void {
    // 오버로드 처리: error(message, error?, context?)
    if (contextOrError instanceof Error) {
      this.log(LogLevel.ERROR, message, contextOrError, context);
    } else if (contextOrError) {
      this.log(LogLevel.ERROR, message, undefined, contextOrError);
    } else {
      this.log(LogLevel.ERROR, message, undefined, context);
    }
  }

  /**
   * 심각한 에러 레벨 로그 (오버로드)
   */
  fatal(message: string, contextOrError?: LogContext | Error, context?: LogContext): void {
    // 오버로드 처리: fatal(message, error?, context?)
    if (contextOrError instanceof Error) {
      this.log(LogLevel.FATAL, message, contextOrError, context);
    } else if (contextOrError) {
      this.log(LogLevel.FATAL, message, undefined, contextOrError);
    } else {
      this.log(LogLevel.FATAL, message, undefined, context);
    }
  }

  /**
   * 로그 레벨 설정
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * 현재 로그 레벨 조회
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * 로거 이름 조회
   */
  getName(): string {
    return this.loggerName;
  }

  /**
   * 출력 핸들러 추가
   *
   * @example
   * logger.addOutput((fields) => {
   *   console.log(JSON.stringify(fields));
   * });
   */
  addOutput(handler: (fields: LogFields) => void): void {
    this.outputs.push(handler);
  }

  /**
   * 내부 로깅 구현
   */
  private log(level: LogLevel, message: string, error?: Error, context?: LogContext): void {
    // 레벨 필터링
    if (!shouldLog(level, this.currentLevel)) {
      return;
    }

    // 로그 필드 구성
    const fields = new LogFieldsBuilder(message)
      .setLevel(level)
      .setProcessType(this.processType)
      .setFile(this.getSourceFile())
      .setLine(this.getSourceLine())
      .setFunction(this.getSourceFunction())
      .setStack(this.getStackTrace());

    // Context 적용
    if (context) {
      if (context.processType) fields.setProcessType(context.processType);
      if (context.module) fields.setModule(context.module);
      if (context.userId) fields.setUserId(context.userId);
      if (context.sessionId) fields.setSessionId(context.sessionId);
      if (context.requestId) fields.setRequestId(context.requestId);
      if (context.metadata) fields.setMetadata(context.metadata);
    }

    // 에러 적용
    if (error) {
      fields.setError(error);
    }

    // 출력
    const logFields = fields.build();
    this.emit(logFields);
  }

  /**
   * 로그 필드를 모든 출력 핸들러에 전달
   */
  private emit(fields: LogFields): void {
    for (const output of this.outputs) {
      try {
        output(fields);
      } catch (err) {
        // 출력 핸들러 오류는 무시 (재귀 방지)
        console.error('[LoggerImpl] Output handler error:', err);
      }
    }
  }

  /**
   * 콘솔 출력 핸들러 추가
   */
  private addConsoleOutput(): void {
    this.addOutput((fields) => {
      const formatted = formatLogFields(fields);
      const color = LOG_LEVEL_COLORS[fields.level];

      // 콘솔 출력 (색상 포함)
      console.log(`${color}${formatted}${RESET_COLOR}`);

      // 에러가 있으면 추가 출력
      if (fields.error) {
        console.log(`${color}  Error: ${fields.error.message}${RESET_COLOR}`);
        if (fields.error.stack) {
          console.log(`${color}  Stack: ${fields.error.stack.split('\n').slice(0, 3).join('\n  ')}${RESET_COLOR}`);
        }
      }

      // 메타데이터가 있으면 JSON 출력
      if (fields.metadata && Object.keys(fields.metadata).length > 0) {
        console.log(`${color}  Metadata: ${JSON.stringify(fields.metadata)}${RESET_COLOR}`);
      }
    });
  }

  /**
   * 소스 파일 추출 (스택 트레이스에서)
   *
   * 성능 최적화: 스택 트레이스 라인을 캐싱하여 반복 계산 방지
   */
  private getSourceFile(): string | undefined {
    try {
      const stack = new Error().stack || '';
      const lines = stack.split('\n');
      if (lines.length > 3 && lines[3]) {
        const stackLine = lines[3];

        // 캐시 확인
        if (this.stackCache.has(stackLine)) {
          return this.stackCache.get(stackLine)?.file;
        }

        const match = stackLine.match(LoggerImpl.FILE_REGEX);
        const file = match?.[1];

        // 캐시 저장 (크기 제한 포함)
        if (this.stackCache.size < this.MAX_CACHE_SIZE) {
          const cached = this.stackCache.get(stackLine) || {};
          if (file !== undefined) {
            this.stackCache.set(stackLine, { ...cached, file });
          }
        }

        return file;
      }
    } catch {
      // 무시
    }
    return undefined;
  }

  /**
   * 소스 라인번호 추출
   *
   * 성능 최적화: 캐시된 값 사용
   */
  private getSourceLine(): number | undefined {
    try {
      const stack = new Error().stack || '';
      const lines = stack.split('\n');
      if (lines.length > 3 && lines[3]) {
        const stackLine = lines[3];

        // 캐시 확인
        if (this.stackCache.has(stackLine)) {
          return this.stackCache.get(stackLine)?.line;
        }

        const match = stackLine.match(LoggerImpl.LINE_REGEX);
        const line = match?.[1] ? parseInt(match[1], 10) : undefined;

        // 캐시 저장 (크기 제한 포함)
        if (this.stackCache.size < this.MAX_CACHE_SIZE && line !== undefined) {
          const cached = this.stackCache.get(stackLine) || {};
          this.stackCache.set(stackLine, { ...cached, line });
        }

        return line;
      }
    } catch {
      // 무시
    }
    return undefined;
  }

  /**
   * 함수명 추출
   *
   * 성능 최적화: 캐시된 값 사용, 정규식 미리 컴파일
   */
  private getSourceFunction(): string | undefined {
    try {
      const stack = new Error().stack || '';
      const lines = stack.split('\n');
      if (lines.length > 3 && lines[3]) {
        const stackLine = lines[3];

        // 캐시 확인
        if (this.stackCache.has(stackLine)) {
          return this.stackCache.get(stackLine)?.fn;
        }

        // 함수명은 보통 "at functionName" 형식
        const match = stackLine.match(LoggerImpl.FUNCTION_REGEX);
        const func = match?.[1];

        // 캐시 저장 (크기 제한 포함)
        if (this.stackCache.size < this.MAX_CACHE_SIZE && func !== undefined) {
          const cached = this.stackCache.get(stackLine) || {};
          this.stackCache.set(stackLine, { ...cached, fn: func });
        }

        return func;
      }
    } catch {
      // 무시
    }
    return undefined;
  }

  /**
   * 전체 스택 트레이스 반환
   */
  private getStackTrace(): string | undefined {
    try {
      const stack = new Error().stack || '';
      const lines = stack.split('\n');
      // 처음 2줄(Error, at LoggerImpl) 제외하고 나머지 반환
      return lines.slice(3, 10).join('\n');
    } catch {
      // 무시
    }
    return undefined;
  }
}
