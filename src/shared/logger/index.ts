/**
 * Logger 모듈 export index
 *
 * Main/Renderer에서 다음과 같이 사용:
 * - import { ILogger, LogLevel, LogContext } from '@shared/logger'
 * - import { LogFieldsBuilder } from '@shared/logger'
 * - import { MainLoggerSymbol, LoggerImpl } from '@shared/logger'
 * - const logger = new LoggerImpl('MainLogger', LogLevel.DEBUG);
 */

export * from './symbols';
export {
  LogLevel,
  LOG_LEVEL_ORDER,
  LOG_LEVEL_NAMES,
  LOG_LEVEL_COLORS,
  RESET_COLOR,
  shouldLog,
  parseLogLevel,
} from './levels';
export type { ILogger, LogContext, LoggerConfig } from './types';
export type { LogFields, LogErrorInfo } from './fields';
export { LogFieldsBuilder, serializeLogFields, formatLogFields } from './fields';
export { LoggerImpl } from './LoggerImpl';
