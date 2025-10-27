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
