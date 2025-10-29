/**
 * Preload API 타입 정의
 * Renderer에서 window.electronAPI 사용 시 타입 안전성 제공
 */

import type { PreloadAPI } from './index';

declare global {
  interface Window {
    electronAPI?: PreloadAPI;
  }
}

export {};
