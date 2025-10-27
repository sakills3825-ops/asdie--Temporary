/**
 * Logger 레벨 정의
 *
 * 6단계 로그 레벨: TRACE (가장 상세) → FATAL (가장 심각)
 *
 * 프로덕션: INFO 이상
 * 개발: DEBUG 이상
 * 디버깅: TRACE 포함
 */

export enum LogLevel {
  /** 가장 상세한 로그 (변수값, 함수흐름, 루프 반복 등) */
  TRACE = 'trace',

  /** 개발 중 디버깅용 로그 */
  DEBUG = 'debug',

  /** 일반 정보성 로그 (앱 시작, 기능 완료 등) */
  INFO = 'info',

  /** 경고 레벨 (비정상이지만 계속 실행 가능) */
  WARN = 'warn',

  /** 에러 레벨 (특정 작업 실패, 예외 발생) */
  ERROR = 'error',

  /** 심각한 에러 (시스템 종료 필요, 복구 불가) */
  FATAL = 'fatal',
}

/** 로그 레벨 순서 (낮은 값 = 더 상세함) */
export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  [LogLevel.TRACE]: 0,
  [LogLevel.DEBUG]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 4,
  [LogLevel.FATAL]: 5,
};

/** 로그 레벨 이름 매핑 */
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.TRACE]: 'TRACE',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO ',
  [LogLevel.WARN]: 'WARN ',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

/** 로그 레벨별 색상 (콘솔 출력용) */
export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.TRACE]: '\x1b[90m', // Dark gray
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m', // Green
  [LogLevel.WARN]: '\x1b[33m', // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  [LogLevel.FATAL]: '\x1b[35m', // Magenta
};

export const RESET_COLOR = '\x1b[0m';

/**
 * 주어진 로그 레벨이 필터링되어야 하는지 판단
 *
 * @example
 * shouldLog(LogLevel.DEBUG, LogLevel.INFO)  // false (DEBUG < INFO)
 * shouldLog(LogLevel.INFO, LogLevel.DEBUG)  // true (INFO > DEBUG)
 */
export function shouldLog(messageLevel: LogLevel, currentLevel: LogLevel): boolean {
  return LOG_LEVEL_ORDER[messageLevel] >= LOG_LEVEL_ORDER[currentLevel];
}

/**
 * 로그 레벨 문자열을 enum으로 변환
 *
 * @example
 * parseLogLevel('debug')   // LogLevel.DEBUG
 * parseLogLevel('invalid') // undefined
 */
export function parseLogLevel(level: unknown): LogLevel | undefined {
  if (typeof level === 'string') {
    const normalized = level.toLowerCase();
    return Object.values(LogLevel).includes(normalized as LogLevel)
      ? (normalized as LogLevel)
      : undefined;
  }
  return undefined;
}
