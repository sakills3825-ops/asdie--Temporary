/**
 * IPC 모듈 export index
 */

export { IPC_CHANNELS } from './channels';
export type { IpcChannel } from './channels';

export {
  isValidIpcChannel,
  getIpcDomain,
  getIpcAction,
  getChannelsByDomain,
  isIpcInDomain,
} from './validators';

export type {
  IpcResponse,
  IpcResponseSuccess,
  IpcResponseError,
  IpcMessageContext,
  IpcInvokeHandler,
  IpcEventHandler,
} from './types';
export { IpcResponseHelper } from './types';

export {
  handleIpcError,
  wrapIpcHandler,
} from './handler-helper';

// ============== P0/P1 이슈 해결: 새로운 exports ==============

/**
 * 채널별 타입 정의 (P0: 채널별 타입 오버로드)
 */
export type {
  IpcChannelMap,
  TypedIpcChannel,
  BrowserNavigateToArgs,
  BrowserNavigateToResponse,
  TabCreateNewArgs,
  TabCreateNewResponse,
  HistoryAddArgs,
  HistoryAddResponse,
  // ... 기타 필요한 타입들
} from './channel-types';

/**
 * 통합 에러 핸들러 및 응답 검증 (P0/P1: 에러 처리)
 */
export {
  handleBaseError,
  handleStandardError,
  handleUnknownError,
  filterErrorMessage,
  filterErrorDetails,
  validateResponseSize,
  isResponseSerializable,
  estimateResponseSize,
  ipcHandlerRegistry,
} from './error-handler';

export {
  MAX_IPC_MESSAGE_SIZE,
  MAX_IPC_ERROR_SIZE,
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_ERROR_DETAILS_DEPTH,
} from './error-handler';

export type { IpcHandlerRegistry } from './error-handler';

/**
 * Args 검증 시스템 (P1: Args 구조 검증)
 */
export {
  validateArgs,
  formatValidationErrors,
  UrlSchema,
  createIdSchema,
  createQuerySchema,
  OptionalUrlSchema,
} from './args-validator';

export type { FieldSchema, ArgsSchema, ValidationResult, ValidationError } from './args-validator';

