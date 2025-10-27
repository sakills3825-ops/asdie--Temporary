/**
 * 공유 타입 모듈 export index
 *
 * Main/Renderer에서 다음과 같이 import:
 * - import type { ElectronAPI, BrowserTab } from '@shared/types'
 * - import { IPC_CHANNELS } from '@shared/types'
 */

// ===== IPC =====
export { IPC_CHANNELS } from '../ipc';
export type { IpcChannel } from '../ipc';

// ===== Electron API =====
export type { ElectronAPI } from './electron';

// ===== 도메인 타입 =====
export type {
  BrowserTab,
  HistoryEntry,
  Bookmark,
  AppSettings,
  FileDialogOptions,
  AppInfo,
} from './domain';
