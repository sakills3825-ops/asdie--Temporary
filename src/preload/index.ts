/**
 * Electron Preload 프로세스
 * - Main 프로세스와 Renderer 프로세스 사이의 안전한 IPC 통신
 * - contextIsolation 활성화 상태에서 안전한 API 노출
 * - 최소 권한 원칙(Principle of Least Privilege) 준수
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel } from '../shared/ipc';
import type { LogFields } from '../shared/logger';

// ============================================================
// 1. 타입 정의
// ============================================================

/**
 * IPC 응답 타입 - invoke 호출에서 사용
 * @internal 내부 사용만
 */
type IpcResponse<T = unknown> = {
  data?: T;
  error?: string;
};

/**
 * 환경 정보 타입
 */
interface EnvironmentInfo {
  isDev: boolean;
  isWin: boolean;
  isMac: boolean;
  isLinux: boolean;
}

/**
 * 로그 메타데이터 타입 - 로거 래퍼에서 사용
 * @internal 내부 사용만
 */
type LogMetadata = {
  label: string;
  message: string;
  metadata?: LogFields;
};

// ============================================================
// 2. Preload API 인터페이스 정의
// ============================================================

/**
 * Renderer에 노출될 IPC API
 */
interface PreloadAPI {
  /**
   * Main 프로세스에서 Promise를 반환하는 핸들러 호출
   */
  invoke: <T = unknown>(channel: IpcChannel, data?: unknown) => Promise<T>;

  /**
   * 일회성 응답 수신 (한 번만)
   */
  once: <T = unknown>(channel: IpcChannel, listener: (data: T) => void) => void;

  /**
   * 지속적인 이벤트 수신
   */
  on: <T = unknown>(channel: IpcChannel, listener: (data: T) => void) => () => void;

  /**
   * 이벤트 리스너 제거
   */
  off: <T = unknown>(channel: IpcChannel, listener: (data: T) => void) => void;

  /**
   * 환경 변수 조회 (제한된 범위)
   */
  getEnvironment: () => EnvironmentInfo;

  /**
   * 앱 버전 조회
   */
  getAppVersion: () => string;

  /**
   * 로그 전달 (Main 프로세스 로거로 통합)
   */
  log: {
    info: (label: string, message: string, metadata?: LogFields) => void;
    warn: (label: string, message: string, metadata?: LogFields) => void;
    error: (label: string, message: string, metadata?: LogFields) => void;
    debug: (label: string, message: string, metadata?: LogFields) => void;
  };
}

// ============================================================
// 3. 래퍼 함수: 타입 안전성 & 에러 처리
// ============================================================

/**
 * IPC invoke 호출 래퍼 - 에러 처리 추가
 */
function createInvokeWrapper(): PreloadAPI['invoke'] {
  return async <T = unknown>(channel: IpcChannel, data?: unknown): Promise<T> => {
    try {
      // Channel 유효성 검증
      if (!channel || typeof channel !== 'string') {
        throw new Error('Invalid IPC channel');
      }

      // Main 프로세스로 invoke 호출
      const response = await ipcRenderer.invoke(channel, data);

      // 응답 검증
      if (response instanceof Error) {
        throw response;
      }

      if (typeof response === 'object' && response !== null && 'error' in response) {
        throw new Error((response as Record<string, unknown>).error as string);
      }

      return (response as IpcResponse<T>)?.data ?? (response as T);
    } catch (error) {
      console.error(`[Preload] IPC invoke 실패 [${channel}]:`, error);
      throw error;
    }
  };
}

/**
 * IPC once 호출 래퍼
 */
function createOnceWrapper(): PreloadAPI['once'] {
  return <T = unknown>(channel: IpcChannel, listener: (data: T) => void): void => {
    try {
      if (!channel || typeof channel !== 'string') {
        throw new Error('Invalid IPC channel');
      }

      ipcRenderer.once(channel, (_event, data) => {
        try {
          listener(data as T);
        } catch (error) {
          console.error(`[Preload] once 리스너 실행 오류:`, error);
        }
      });
    } catch (error) {
      console.error(`[Preload] once 설정 오류:`, error);
    }
  };
}

/**
 * IPC on 호출 래퍼 - 제거 함수 반환
 */
function createOnWrapper(): PreloadAPI['on'] {
  return <T = unknown>(channel: IpcChannel, listener: (data: T) => void): (() => void) => {
    try {
      if (!channel || typeof channel !== 'string') {
        throw new Error('Invalid IPC channel');
      }

      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
        try {
          listener(data as T);
        } catch (error) {
          console.error(`[Preload] on 리스너 실행 오류:`, error);
        }
      };

      ipcRenderer.on(channel, handler);

      // 제거 함수 반환
      return () => {
        ipcRenderer.off(channel, handler);
      };
    } catch (error) {
      console.error(`[Preload] on 설정 오류:`, error);
      return () => {}; // 빈 함수 반환
    }
  };
}

/**
 * IPC off 호출 래퍼
 */
function createOffWrapper(): PreloadAPI['off'] {
  return <T = unknown>(channel: IpcChannel, listener: (data: T) => void): void => {
    try {
      if (!channel || typeof channel !== 'string') {
        throw new Error('Invalid IPC channel');
      }

      // Electron의 타입 시스템에 맞춰 캐스트
      const eventListener = listener as (...args: unknown[]) => void;
      ipcRenderer.off(channel, eventListener);
    } catch (error) {
      console.error(`[Preload] off 호출 오류:`, error);
    }
  };
}

/**
 * 환경 정보 조회
 */
function getEnvironment() {
  return {
    isDev: process.env.NODE_ENV === 'development',
    isWin: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
  };
}

/**
 * 앱 버전 조회
 */
function getAppVersion(): string {
  return process.env.APP_VERSION || '1.0.0';
}

/**
 * 로거 래퍼 - Main 프로세스의 로거로 전달
 */
function createLoggerWrapper(): PreloadAPI['log'] {
  return {
    info: (label: string, message: string, metadata?: LogFields) => {
      ipcRenderer.send('log:info', { label, message, metadata } as LogMetadata);
    },
    warn: (label: string, message: string, metadata?: LogFields) => {
      ipcRenderer.send('log:warn', { label, message, metadata } as LogMetadata);
    },
    error: (label: string, message: string, metadata?: LogFields) => {
      ipcRenderer.send('log:error', { label, message, metadata } as LogMetadata);
    },
    debug: (label: string, message: string, metadata?: LogFields) => {
      ipcRenderer.send('log:debug', { label, message, metadata } as LogMetadata);
    },
  };
}

// ============================================================
// 4. Context Bridge를 통한 API 노출
// ============================================================

const preloadAPI: PreloadAPI = {
  invoke: createInvokeWrapper(),
  once: createOnceWrapper(),
  on: createOnWrapper(),
  off: createOffWrapper(),
  getEnvironment,
  getAppVersion,
  log: createLoggerWrapper(),
};

try {
  contextBridge.exposeInMainWorld('electronAPI', preloadAPI);
  console.log('[Preload] API 노출 완료');
} catch (error) {
  console.error('[Preload] Context bridge 설정 오류:', error);
}

export type { PreloadAPI };
export default preloadAPI;
