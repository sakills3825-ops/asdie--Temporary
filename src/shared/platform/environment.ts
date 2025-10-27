/**
 * 플랫폼별 환경 설정
 *
 * 시스템 정보, 성능 특성, 동작 방식 등 플랫폼 특화 설정
 */

import os from 'os';
import { getPlatform, Platform, getEnvVariable } from './paths';

/**
 * 시스템 정보
 */
export interface SystemInfo {
  platform: Platform;
  arch: string; // 'x64', 'arm64' 등
  cpuCount: number; // CPU 코어 수
  totalMemory: number; // 전체 메모리 (bytes)
  availableMemory: number; // 사용 가능 메모리 (bytes)
  uptime: number; // 시스템 부팅 후 경과시간 (초)
  nodeVersion: string; // Node.js 버전
  electronVersion?: string; // Electron 버전 (선택)
}

/**
 * 현재 시스템 정보 수집
 *
 * @example
 * const info = getSystemInfo();
 * console.log(info.cpuCount);      // 8
 * console.log(info.totalMemory);   // 17179869184
 */
export function getSystemInfo(): SystemInfo {
  return {
    platform: getPlatform(),
    arch: process.arch,
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    availableMemory: os.freemem(),
    uptime: os.uptime(),
    nodeVersion: process.version,
  };
}

/**
 * 플랫폼별 성능 특성 (하드웨어 제약)
 */
export interface PerformanceConfig {
  // 동시 작업 수
  maxConcurrentTasks: number;

  // 메모리 제한 (MB)
  maxMemoryUsage: number;

  // 캐시 크기 (MB)
  maxCacheSize: number;

  // 이벤트 루프 배치 크기
  eventLoopBatchSize: number;

  // 제한: 탭 최대 개수
  maxTabsPerWindow: number;

  // 제한: 히스토리 항목 최대 개수
  maxHistoryItems: number;
}

/**
 * 플랫폼별 성능 설정
 *
 * 저사양(모바일/라즈베리파이) vs 고사양(데스크톱) 구분
 */
export function getPerformanceConfig(): PerformanceConfig {
  const systemInfo = getSystemInfo();
  const cpuCount = systemInfo.cpuCount;
  const totalMemory = systemInfo.totalMemory / (1024 * 1024); // MB로 변환

  // 저사양 장비 (메모리 < 4GB 또는 CPU 1-2개)
  if (totalMemory < 4096 || cpuCount <= 2) {
    return {
      maxConcurrentTasks: 2,
      maxMemoryUsage: 256,
      maxCacheSize: 50,
      eventLoopBatchSize: 10,
      maxTabsPerWindow: 20,
      maxHistoryItems: 1000,
    };
  }

  // 중간사양 (메모리 4-8GB, CPU 4-8개)
  if (totalMemory < 8192 || cpuCount <= 8) {
    return {
      maxConcurrentTasks: 4,
      maxMemoryUsage: 512,
      maxCacheSize: 200,
      eventLoopBatchSize: 50,
      maxTabsPerWindow: 50,
      maxHistoryItems: 5000,
    };
  }

  // 고사양 (메모리 > 8GB, CPU > 8개)
  return {
    maxConcurrentTasks: 8,
    maxMemoryUsage: 1024,
    maxCacheSize: 500,
    eventLoopBatchSize: 100,
    maxTabsPerWindow: 100,
    maxHistoryItems: 10000,
  };
}

/**
 * 플랫폼별 UI 설정
 */
export interface UIConfig {
  // 텍스트 스케일 팩터
  scaleFactor: number;

  // 터치스크린 지원 여부
  touchSupport: boolean;

  // 다크모드 지원
  darkModeSupport: boolean;

  // 네이티브 창 장식 (프레임)
  nativeWindowFrame: boolean;
}

/**
 * 플랫폼별 UI 설정 조회
 *
 * @example
 * const config = getUIConfig();
 * console.log(config.nativeWindowFrame);  // macOS: true, Windows: false
 */
export function getUIConfig(): UIConfig {
  const platform = getPlatform();

  return {
    scaleFactor: getDisplayScaleFactor(),
    touchSupport: platform === 'win32', // Windows는 터치 지원 가능
    darkModeSupport: true, // 모든 플랫폼 지원
    nativeWindowFrame: platform === 'darwin', // macOS는 네이티브 프레임
  };
}

/**
 * 디스플레이 스케일 팩터 (화면 DPI)
 *
 * macOS Retina: 2.0
 * 일반 모니터: 1.0
 * 고해상도: 1.5+
 */
export function getDisplayScaleFactor(): number {
  if (typeof window !== 'undefined' && window.devicePixelRatio) {
    return window.devicePixelRatio;
  }

  // Node.js 환경 (Electron main process)
  const platform = getPlatform();
  if (platform === 'darwin') {
    // macOS Retina 디스플레이는 기본 2.0
    return 2.0;
  }

  // Windows, Linux는 일반적으로 1.0
  return 1.0;
}

/**
 * 플랫폼별 기능 지원 여부
 */
export interface FeatureSupport {
  // Native 확장 프로그램 지원
  nativeExtensions: boolean;

  // 하드웨어 가속
  hardwareAcceleration: boolean;

  // Sandbox 모드
  sandbox: boolean;

  // V8 코드 캐싱
  v8CodeCaching: boolean;

  // 시스템 통합 (공유, 전자메일 등)
  systemIntegration: boolean;
}

/**
 * 플랫폼별 기능 지원 확인
 *
 * @example
 * const support = getFeatureSupport();
 * if (support.sandbox) {
 *   // Sandbox 모드 활성화
 * }
 */
export function getFeatureSupport(): FeatureSupport {
  const platform = getPlatform();

  return {
    nativeExtensions: true, // 모든 플랫폼 지원
    hardwareAcceleration: true, // 모든 플랫폼 지원 (GPU 있을 시)
    sandbox: true, // 모든 플랫폼 지원
    v8CodeCaching: true, // Electron 6.0+
    systemIntegration: platform !== 'linux', // Linux는 제한적
  };
}

/**
 * 환경 변수 기반 플랫폼 환경 설정
 *
 * @example
 * const debugMode = getEnvironmentSettings().isDebug;
 */
export interface EnvironmentSettings {
  isDebug: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
  logLevel: string;
}

export function getEnvironmentSettings(): EnvironmentSettings {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logLevel = getEnvVariable('LOG_LEVEL') || 'info';
  const debug = getEnvVariable('DEBUG') === 'true' || false;

  return {
    isDebug: debug,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    logLevel,
  };
}
