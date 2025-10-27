/**
 * 시스템 성능 능력 감지 (초기화 시점)
 *
 * platform/environment.ts에서 수집한 하드웨어 정보를 기반으로
 * 현재 시스템의 성능 능력을 캡슐화합니다.
 *
 * 차이점:
 * - environment.ts: "이 컴퓨터의 스펙은?" (정적, 변하지 않음)
 * - capabilities.ts: "지금 최적 설정은?" (동적, 사용자 설정 반영)
 * - monitoring.ts: "지금 실제 상태는?" (실시간, 끊임없이 변함)
 */

import { getSystemInfo, getPerformanceConfig } from '@shared/platform/environment';
import { PERFORMANCE_TIERS, SLOW_NETWORK_RTT_MS, VERY_SLOW_NETWORK_RTT_MS } from './constants';

// ============================================================================
// GPU 능력 정의
// ============================================================================

export type GPUTier = 'low' | 'mid' | 'high' | 'unknown';

/**
 * GPU 능력 정보
 *
 * WebGL 정보와 성능 특성을 캡슐화합니다.
 */
export interface GPUCapabilities {
  // GPU 렌더러 이름
  renderer: string;

  // GPU 벤더 이름
  vendor: string;

  // WebGL 버전
  webglVersion: 'webgl' | 'webgl2' | 'none';

  // WebGPU 지원 여부
  webgpuSupported: boolean;

  // 하드웨어 가속 활성화
  hardwareAccelerated: boolean;

  // GPU 계층 (렌더러 문자열 기반)
  tier: GPUTier;

  // 추가 정보
  driverVersion?: string;
}

/**
 * GPU 능력 감지 (Electron main process 또는 renderer)
 *
 * Main process에서 호출 시: app.getGPUInfo() 사용
 * Renderer에서 호출 시: WebGL 컨텍스트 생성
 *
 * @example
 * const gpu = await getGPUCapabilities();
 * console.log(gpu.tier);  // 'high'
 * if (gpu.tier === 'low') {
 *   // 저성능 GPU: 셰이더 복잡도 감소
 * }
 */
export async function getGPUCapabilities(): Promise<GPUCapabilities> {
  // Electron main process 환경 감지
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const { app } = require('electron');
      const gpuInfo = app.getGPUInfo('basic');

      return {
        renderer: gpuInfo.gpuDevice?.[0]?.deviceName || 'Unknown',
        vendor: gpuInfo.gpuDevice?.[0]?.vendorId || 'Unknown',
        webglVersion: 'webgl2',
        webgpuSupported: false,
        hardwareAccelerated: true,
        tier: classifyGPUTier(gpuInfo.gpuDevice?.[0]?.deviceName || ''),
        driverVersion: gpuInfo.machineModelName,
      };
    } catch {
      // Electron 미사용 또는 오류 발생
    }
  }

  // Renderer 환경: WebGL 컨텍스트 생성
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown';

      return {
        renderer: String(renderer),
        vendor: String(vendor),
        webglVersion: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
        webgpuSupported: checkWebGPUSupport(),
        hardwareAccelerated: !String(renderer).includes('Software'),
        tier: classifyGPUTier(String(renderer)),
      };
    }
  }

  // WebGL 미지원
  return {
    renderer: 'Unknown',
    vendor: 'Unknown',
    webglVersion: 'none',
    webgpuSupported: false,
    hardwareAccelerated: false,
    tier: 'unknown',
  };
}

/**
 * GPU 렌더러 문자열을 계층으로 분류
 *
 * 패턴 분석:
 * - 'Apple' → Metal (macOS) → 'high'
 * - 'NVIDIA' → CUDA (고성능) → 'high'
 * - 'AMD' → RDNA (중급) → 'mid'
 * - 'Intel' → iGPU (저성능) → 'low'
 * - 'Software' → CPU 렌더링 → 'low'
 * - '제조사 없음' → 모바일/이상 → 'low'
 */
export function classifyGPUTier(renderer: string): GPUTier {
  const rendererLower = renderer.toLowerCase();

  // 고성능: 전용 GPU
  if (
    rendererLower.includes('nvidia') ||
    rendererLower.includes('geforce') ||
    rendererLower.includes('apple') ||
    rendererLower.includes('metal')
  ) {
    return 'high';
  }

  // 중간성능: AMD / 상급 iGPU
  if (
    rendererLower.includes('amd') ||
    rendererLower.includes('radeon') ||
    rendererLower.includes('iris') // Intel Iris (고사양 iGPU)
  ) {
    return 'mid';
  }

  // 저성능: Intel iGPU / 소프트웨어 렌더링
  if (
    rendererLower.includes('intel') ||
    rendererLower.includes('software') ||
    rendererLower.includes('angle')
  ) {
    return 'low';
  }

  // 불명: 분류 불가
  return 'unknown';
}

/**
 * WebGPU 지원 여부 확인
 *
 * @see https://caniuse.com/webgpu
 */
function checkWebGPUSupport(): boolean {
  if (typeof window === 'undefined') return false;
  return 'gpu' in navigator;
}

// ============================================================================
// CPU 능력 정의
// ============================================================================

/**
 * CPU 능력 정보
 *
 * 하드웨어 코어 수와 권장 동시작업 수를 제공합니다.
 */
export interface CPUCapabilities {
  // 물리 코어 수
  cores: number;

  // 권장 워커 스레드 수
  recommendedWorkerThreads: number;

  // 최대 동시 작업 수 (초기 설정)
  maxConcurrentTasks: number;

  // 권장 이벤트 루프 배치 크기
  eventLoopBatchSize: number;

  // 서버 가능 여부 (멀티코어)
  suitableForServer: boolean;
}

/**
 * CPU 능력 감지
 *
 * platform/environment.ts의 getSystemInfo()를 활용하여
 * environment 중복을 제거합니다.
 *
 * @example
 * const cpu = getCPUCapabilities();
 * console.log(cpu.cores);  // 8
 * console.log(cpu.recommendedWorkerThreads);  // 4
 */
export function getCPUCapabilities(): CPUCapabilities {
  const systemInfo = getSystemInfo();
  const perfConfig = getPerformanceConfig();

  const cores = systemInfo.cpuCount;

  return {
    cores,
    recommendedWorkerThreads: perfConfig.maxConcurrentTasks,
    maxConcurrentTasks: perfConfig.maxConcurrentTasks,
    eventLoopBatchSize: perfConfig.eventLoopBatchSize,
    suitableForServer: cores >= 4 && perfConfig.maxConcurrentTasks >= 4,
  };
}

// ============================================================================
// Memory 능력 정의
// ============================================================================

export type MemoryTier = 'low' | 'mid' | 'high';

/**
 * 메모리 능력 정보
 *
 * 시스템 메모리 크기와 할당 정책을 제공합니다.
 */
export interface MemoryCapabilities {
  // 전체 메모리 (bytes)
  totalMemory: number;

  // 현재 사용 가능 메모리 (bytes)
  availableMemory: number;

  // 메모리 계층 (저/중/고)
  tier: MemoryTier;

  // V8 최대 힙 크기 (bytes, 권장)
  maxHeapSize: number;

  // GC 임계값 (bytes)
  gcThreshold: number;

  // HTTP 캐시 최대 크기 (bytes)
  httpCacheSize: number;

  // IndexedDB 최대 크기 (bytes)
  indexedDBSize: number;
}

/**
 * 메모리 능력 감지
 *
 * @example
 * const memory = getMemoryCapabilities();
 * console.log(memory.tier);  // 'high'
 * console.log(memory.gcThreshold);  // ~784 (시스템에 따라 다름)
 */
export function getMemoryCapabilities(): MemoryCapabilities {
  const systemInfo = getSystemInfo();

  // 메모리 계층 결정 (environment.ts와 동일한 로직)
  const totalMemoryMB = systemInfo.totalMemory / (1024 * 1024);
  let tier: MemoryTier;

  if (totalMemoryMB < 4096 || systemInfo.cpuCount <= 2) {
    tier = 'low';
  } else if (totalMemoryMB < 8192 || systemInfo.cpuCount <= 8) {
    tier = 'mid';
  } else {
    tier = 'high';
  }

  // 성능 설정에서 상수 가져오기 (PERFORMANCE_TIERS 활용)
  const tierConfig = PERFORMANCE_TIERS[tier];

  return {
    totalMemory: systemInfo.totalMemory,
    availableMemory: systemInfo.availableMemory,
    tier,
    maxHeapSize: Math.floor(systemInfo.totalMemory * 0.3), // 총 메모리의 30%
    gcThreshold: tierConfig.gcThresholdMB * 1024 * 1024, // bytes로 변환
    httpCacheSize: tierConfig.httpCacheSizeMB * 1024 * 1024,
    indexedDBSize: tierConfig.indexedDBSizeMB * 1024 * 1024,
  };
}

// ============================================================================
// Network 능력 정의
// ============================================================================

export type NetworkTier = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

/**
 * 네트워크 능력 정보
 *
 * 네트워크 속도와 품질을 제공합니다.
 */
export interface NetworkCapabilities {
  // 예상 네트워크 타입
  effectiveType: NetworkTier;

  // Round-Trip Time (ms)
  rtt: number;

  // 다운링크 속도 (Mbps)
  downlink: number;

  // 데이터 절감 모드
  saveData: boolean;

  // 네트워크 계층 (느림/정상/빠름)
  tier: 'slow' | 'normal' | 'fast';

  // 비디오 자동재생 권장
  shouldAutoplayVideo: boolean;

  // 권장 이미지 품질 (0.3-1.0)
  recommendedImageQuality: number;

  // 권장 동시 다운로드 수
  recommendedConcurrentDownloads: number;
}

/**
 * 네트워크 능력 감지 (초기값)
 *
 * 앱 시작 시 한 번 호출.
 * 실시간 변화는 monitoring.ts의 NetworkMonitor에서 추적합니다.
 *
 * @example
 * const network = getNetworkCapabilities();
 * if (network.tier === 'slow') {
 *   // 느린 네트워크: 비디오 자동재생 비활성화
 * }
 */
export function getNetworkCapabilities(): NetworkCapabilities {
  // Renderer 환경에서만 사용 가능
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    // Main process 또는 미지원 환경: 기본값 반환
    return getDefaultNetworkCapabilities();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connection = (navigator as any).connection;
  const effectiveType: NetworkTier = (connection.effectiveType as NetworkTier) || '4g';
  const rtt = (connection.rtt as number) || 50;
  const downlink = (connection.downlink as number) || 10;
  const saveData = (connection.saveData as boolean) || false;

  return createNetworkCapabilities(effectiveType, rtt, downlink, saveData);
}

/**
 * 네트워크 정보로부터 능력 생성
 *
 * @internal
 */
export function createNetworkCapabilities(
  effectiveType: NetworkTier,
  rtt: number,
  downlink: number,
  saveData: boolean
): NetworkCapabilities {
  // 계층 결정
  const tier =
    saveData || rtt > VERY_SLOW_NETWORK_RTT_MS
      ? 'slow'
      : rtt > SLOW_NETWORK_RTT_MS
        ? 'slow'
        : 'normal';

  // 비디오 자동재생 여부
  const shouldAutoplayVideo = tier === 'normal' && downlink >= 1;

  // 이미지 품질 (느린 네트워크일수록 낮음)
  let recommendedImageQuality = 1.0;
  if (tier === 'slow') {
    recommendedImageQuality = effectiveType === 'slow-2g' ? 0.3 : 0.5;
  }

  // 동시 다운로드 수 (느린 네트워크일수록 적음)
  const recommendedConcurrentDownloads = tier === 'slow' ? 2 : tier === 'normal' ? 6 : 10;

  return {
    effectiveType,
    rtt,
    downlink,
    saveData,
    tier,
    shouldAutoplayVideo,
    recommendedImageQuality,
    recommendedConcurrentDownloads,
  };
}

/**
 * 기본 네트워크 능력 (미지원 환경)
 *
 * @internal
 */
function getDefaultNetworkCapabilities(): NetworkCapabilities {
  return createNetworkCapabilities('4g', 50, 10, false);
}

// ============================================================================
// Battery 능력 정의
// ============================================================================

/**
 * 배터리 능력 정보
 *
 * 모바일 장치의 배터리 상태를 제공합니다.
 */
export interface BatteryCapabilities {
  // 배터리 충전 상태 (0-1)
  level: number;

  // 충전 중 여부
  charging: boolean;

  // 배터리 절전 모드 활성화
  powerSaverEnabled: boolean;

  // 배터리 상태: 'ok' | 'warning' | 'critical'
  status: 'ok' | 'warning' | 'critical';
}

/**
 * 배터리 능력 감지 (선택사항, 모바일 전용)
 *
 * Battery Status API (deprecated이지만 아직 많은 모바일 브라우저 지원)
 * 또는 navigator.deviceMemory 등으로 대체 검토 필요
 *
 * @example
 * const battery = await getBatteryCapabilities();
 * if (battery.status === 'critical') {
 *   // 배터리 위험: 백그라운드 작업 중단
 * }
 */
export async function getBatteryCapabilities(): Promise<BatteryCapabilities> {
  // Battery Status API (deprecated)
  if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const battery = await (navigator as any).getBattery();
      const level = battery.level || 1.0;
      const charging = battery.charging || false;

      // 상태 결정
      let status: 'ok' | 'warning' | 'critical';
      if (level < 0.05) {
        status = 'critical';
      } else if (level < 0.2 && !charging) {
        status = 'warning';
      } else {
        status = 'ok';
      }

      return {
        level,
        charging,
        powerSaverEnabled: level < 0.2 && !charging,
        status,
      };
    } catch {
      // Battery API 미지원
    }
  }

  // 기본값 (배터리 미지원 환경)
  return {
    level: 1.0,
    charging: true,
    powerSaverEnabled: false,
    status: 'ok',
  };
}

// ============================================================================
// 통합 능력 정의
// ============================================================================

/**
 * 모든 시스템 능력의 통합 정보
 */
export interface SystemCapabilities {
  gpu: GPUCapabilities;
  cpu: CPUCapabilities;
  memory: MemoryCapabilities;
  network: NetworkCapabilities;
  battery?: BatteryCapabilities;
}

/**
 * 전체 시스템 능력 수집
 *
 * GPU와 배터리는 비동기 작업이므로 async 함수
 *
 * @example
 * const capabilities = await getAllCapabilities();
 * console.log(capabilities.gpu.tier);
 * console.log(capabilities.cpu.cores);
 */
export async function getAllCapabilities(): Promise<SystemCapabilities> {
  const [gpu, battery] = await Promise.all([getGPUCapabilities(), getBatteryCapabilities()]);

  return {
    gpu,
    cpu: getCPUCapabilities(),
    memory: getMemoryCapabilities(),
    network: getNetworkCapabilities(),
    battery,
  };
}
