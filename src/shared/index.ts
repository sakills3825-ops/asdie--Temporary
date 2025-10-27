/**
 * @shared 모듈 루트 export
 *
 * src/shared의 모든 공개 API를 여기서 export.
 * Main/Renderer에서 다음과 같이 사용:
 *
 * - import { IPC_CHANNELS, isValidIpcChannel } from '@shared'
 * - import { MainLoggerSymbol, ILogger } from '@shared'
 * - import { ERROR_CODES, LIMITS } from '@shared'
 * - import { BaseError, ValidationError } from '@shared'
 * - import { withTimeout, validateUrl } from '@shared'
 */

// ===== Logger =====
export { LoggerSymbol, MainLoggerSymbol, RendererLoggerSymbol, LogLevel, LoggerImpl } from './logger';
export type { ILogger, LogContext, LoggerConfig } from './logger';

// ===== IPC =====
export { IPC_CHANNELS } from './ipc';
export type {
  IpcChannel,
  IpcResponse,
  IpcResponseSuccess,
  IpcResponseError,
  IpcMessageContext,
  IpcInvokeHandler,
  IpcEventHandler,
} from './ipc';
export {
  isValidIpcChannel,
  getIpcDomain,
  getIpcAction,
  getChannelsByDomain,
  isIpcInDomain,
  IpcResponseHelper,
  handleIpcError,
  wrapIpcHandler,
} from './ipc';

// ===== Types =====
export type { ElectronAPI } from './types/electron';
export type {
  BrowserTab,
  HistoryEntry,
  Bookmark,
  AppSettings,
  FileDialogOptions,
  AppInfo,
} from './types/domain';

// ===== Constants =====
export { ERROR_CODES, LIMITS, DEBOUNCE_MS, CACHE_DURATION_MS } from './constants';
export type { ErrorCode } from './constants';

// ===== Errors =====
export {
  BaseError,
  ValidationError,
  IpcChannelError,
  FileError,
  NetworkError,
  DatabaseError,
  TimeoutError,
  NotFoundError,
  WindowError,
} from './errors';

// ===== Utils =====
export {
  isValidUrl,
  validateUrl,
  isValidEmail,
  isValidFilePath,
  validateFilePath,
  validateRequired,
  validateRange,
  validateStringLength,
} from './utils';

export {
  withTimeout,
  withRetry,
  delay,
  sequential,
  parallel,
  race,
  CancelablePromise,
} from './utils';
