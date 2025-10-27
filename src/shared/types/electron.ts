/**
 * Electron API 타입 정의
 * Renderer Process에서 사용 가능한 API 인터페이스
 */

import type { IpcChannel, IpcResponse } from '../ipc';

/**
 * Electron API 제공 인터페이스
 * preload.ts에서 contextBridge로 노출되는 API
 *
 * 채널별 invoke 호출:
 * - invoke('browser:navigate', url) → Promise<IpcResponse<void>>
 * - invoke('bookmark:getAll') → Promise<IpcResponse<Bookmark[]>>
 */
export interface ElectronAPI {
  /**
   * IPC invoke - Main에서 응답을 받고 Promise 반환
   *
   * 타입 안전 사용:
   * @example
   * const result = await window.electronAPI!.invoke<string>('browser:navigate', url);
   * if (result.success) {
   *   console.log('Navigated to:', result.data);
   * } else {
   *   console.error('Navigation failed:', result.error);
   * }
   */
  invoke<T = void>(channel: IpcChannel, ...args: unknown[]): Promise<IpcResponse<T>>;

  /**
   * IPC send - Main으로 메시지 전송 (응답 없음)
   */
  send(channel: IpcChannel, ...args: unknown[]): void;

  /**
   * IPC on - Main으로부터 메시지 수신 리스너 등록
   *
   * @returns 리스너 제거 함수
   */
  on(channel: IpcChannel, callback: (...args: unknown[]) => void): () => void;

  /**
   * IPC once - Main으로부터 메시지 한 번만 수신
   */
  once(channel: IpcChannel, callback: (...args: unknown[]) => void): void;

  /**
   * IPC removeListener - 리스너 제거
   */
  removeListener(channel: IpcChannel, callback: (...args: unknown[]) => void): void;
}

/**
 * Window 객체 확장 타입
 */
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
