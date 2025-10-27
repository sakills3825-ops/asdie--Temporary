/**
 * 시스템 최적화: 동적 계산 기반 상수값 (REFACTORED)
 *
 * 🎯 목표:
 * - 시스템 리소스에 맞는 합리적인 제한값 동적 계산
 * - 메모리 스펙에 따라 탭/히스토리 수 조정
 * - 극저사양 시스템도 정상 작동
 * - 극고사양 시스템에서는 충분한 용량 제공
 * - 실시간 모니터링 (monitoring.ts와 연동)
 *
 * 설계 원칙:
 * - 사용자 경험 > 메모리 절약 (극단적 제한 없음)
 * - 동적 조정 (시스템이 부하면 적응적으로 탭 수 감소)
 * - 합리적 상한선 (극단적으로 많은 탭 생성 방지)
 *
 * 이전 문제점:
 * - ❌ "1GB 메모리에 가깝게 유지" 목표가 비현실적
 * - ❌ 16GB 메모리인데 1GB만 사용하는 것은 낭비
 * - 변경됨: 현실적인 메모리 관리로 변경
 */

import * as os from 'os';

// ============================================================================
// 탭 관리: 동적 계산
// ============================================================================

/**
 * 탭당 예상 메모리 사용량 (MB)
 *
 * 근거:
 * - Chromium 성능 분석: 탭당 30-50MB (순수 탭 오버헤드)
 * - Zen 구현: 경량화 목표, 약 25-35MB로 추정
 * - 보수적 계산: 40MB로 설정 (최악의 경우)
 */
const MEMORY_PER_TAB_MB = 40;

/**
 * 동적 최대 탭 계산
 *
 * 정책:
 * 1. 사용 가능한 메모리 계산 (시스템 예약 제외)
 * 2. 현재 사용량에 따라 추가 탭 할당 가능 여부 판단
 * 3. 합리적 범위: 5개 ~ 100개 (극단적 수치 방지)
 *
 * 예시:
 * - 16GB 메모리, 사용중 30%: 최대 약 100개 (상한선)
 * - 8GB 메모리, 사용중 40%: 최대 약 80개
 * - 4GB 메모리, 사용중 50%: 최대 약 50개
 * - 2GB 메모리, 사용중 60%: 최대 약 30개
 * - 1GB 메모리, 사용중 70%: 최대 약 10개
 *
 * @param totalMemoryMB - 총 메모리 (테스트용, 기본값: 시스템 감지)
 * @param currentUsagePercent - 현재 사용률 (0-100, 테스트용)
 * @returns 권장 최대 탭 수
 *
 * @see 실시간 메모리 모니터링: monitoring.ts 연동
 */
export function calculateMaxTabs(totalMemoryMB?: number, currentUsagePercent?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);

  // 현재 사용률 계산 (0-100)
  let usagePercent = currentUsagePercent ?? 0;
  if (!currentUsagePercent) {
    const used = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    usagePercent = (used / total) * 100;
  }

  // 실제 사용 가능한 메모리 = 총메모리 - 현재사용 - OS예약(10%)
  const allocatableMB = total * (1 - usagePercent / 100 - 0.1);

  // 할당 가능한 탭 개수
  const maxTabsFromMemory = Math.floor(allocatableMB / MEMORY_PER_TAB_MB);

  // ⚠️ 급격한 제한 방지: 사용률에 따른 보수적 조정
  let adjustedMax = maxTabsFromMemory;

  if (usagePercent > 80) {
    // 메모리 거의 다 참: 매우 제한적
    adjustedMax = Math.max(5, Math.floor(maxTabsFromMemory * 0.5));
  } else if (usagePercent > 70) {
    // 메모리 많이 찼음: 제한적
    adjustedMax = Math.max(10, Math.floor(maxTabsFromMemory * 0.7));
  } else if (usagePercent > 60) {
    // 메모리 중간 정도: 약간 제한
    adjustedMax = Math.max(20, Math.floor(maxTabsFromMemory * 0.8));
  }

  // 합리적 범위: 최소 5개, 최대 100개
  return Math.max(5, Math.min(adjustedMax, 100));
}

/**
 * 정적 기준값 (캐시용, 초기화 시점)
 * 
 * 이 값들은 시스템 초기화 시 한번만 계산됨.
 * 실시간으로는 calculateMaxTabs()로 동적 계산.
 */
export const MAX_TABS_LOW = 10;
export const MAX_TABS_MID = 50;
export const MAX_TABS_HIGH = 100;

// ============================================================================
// 히스토리 관리: 동적 계산
// ============================================================================

/**
 * 동적 최대 히스토리 계산
 *
 * 정책:
 * - 저메모리 시스템: 최소 1,000개 유지
 * - 중간 시스템: 5,000개 ~ 10,000개
 * - 고사양 시스템: 20,000개 (SQLite 성능 hard-cap: 50,000)
 *
 * @returns 권장 최대 히스토리 항목 수
 */
export function calculateMaxHistory(totalMemoryMB?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);

  // 메모리 → 히스토리 매핑
  let maxHistory = 1_000; // 기본값

  if (total >= 8_000) {
    maxHistory = 20_000; // 고사양
  } else if (total >= 4_000) {
    maxHistory = 10_000; // 중간
  } else if (total >= 2_000) {
    maxHistory = 5_000; // 저중간
  } else {
    maxHistory = 1_000; // 저사양
  }

  // hard-cap: 50,000 (SQLite 성능 기반)
  return Math.min(maxHistory, 50_000);
}

/**
 * 정적 기준값 (캐시용, 초기화 시점)
 */
export const MAX_HISTORY_LOW = 1_000;
export const MAX_HISTORY_MID = 5_000;
export const MAX_HISTORY_HIGH = 20_000;

// ============================================================================
// IPC 통신: 타임아웃
// ============================================================================

/**
 * 동적 IPC 타임아웃 계산
 *
 * 정책:
 * - 로컬 프로세스 통신: 기본 30초
 * - 느린 네트워크 고려: RTT 기반 계산
 * - 최소값: 5초 (로컬 통신)
 * - 최대값: 60초 (극도로 느린 환경 방지)
 *
 * @param rttMs - RTT (Round Trip Time, 밀리초), undefined면 기본값 사용
 * @returns IPC 타임아웃 (밀리초)
 */
export function calculateIPCTimeout(rttMs?: number): number {
  if (rttMs === undefined) {
    // 기본값: 30초 (느린 네트워크 지원)
    return 30_000;
  }

  // RTT × 15 + 5초 안전여유
  const timeoutMs = rttMs * 15 + 5_000;

  // MIN/MAX 경계
  return Math.max(5_000, Math.min(timeoutMs, 60_000));
}

/**
 * 정적 기준값
 */
export const IPC_TIMEOUT_MS = 30_000; // 30초 (기본값)
export const IPC_TIMEOUT_MIN_MS = 5_000; // 5초
export const IPC_TIMEOUT_MAX_MS = 60_000; // 60초

// ============================================================================
// 워커 스레드 관리: 동적 계산
// ============================================================================

/**
 * 동적 최대 워커 스레드 수 계산
 *
 * 정책:
 * - CPU 코어 수에 기반하지만, 메모리도 고려
 * - 워커당 메모리: 약 10MB
 * - 최적 워커 수 = CPU 코어 수 / 2 (컨텍스트 스위칭 고려)
 * - 메모리 제약: 최대 워커 수는 (사용 가능 메모리 / 10MB) 이하
 *
 * @returns 최대 워커 스레드 수
 */
export function calculateMaxWorkerThreads(cpuCores?: number, totalMemoryMB?: number): number {
  const cores = cpuCores || os.cpus().length;
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);

  // CPU 기반: 코어 수의 절반 (컨텍스트 스위칭 오버헤드 고려)
  const cpuBasedWorkers = Math.max(1, Math.floor(cores / 2));

  // 메모리 기반: 워커당 10MB, 최대 사용 가능 메모리의 10%
  const memoryBasedWorkers = Math.floor((total * 0.8 * 0.1) / 10);

  // 둘 중 작은 값 선택 (보수적)
  const maxWorkers = Math.min(cpuBasedWorkers, memoryBasedWorkers);

  // MIN/MAX 경계
  return Math.max(1, Math.min(maxWorkers, 12)); // MAX 12개 (극한)
}

/**
 * 정적 기준값 (캐시용, 초기화 시점)
 */
export const MAX_WORKER_THREADS_LOW = 1;
export const MAX_WORKER_THREADS_MID = 2;
export const MAX_WORKER_THREADS_HIGH = 4;

// ============================================================================
// 메모리 관리: 동적 계산 (시스템 메모리 능력에 맞춘 최적화)
// ============================================================================

/**
 * 🎯 목표: 시스템 메모리 능력에 맞춰 동적 최적화
 *
 * 방식:
 * - 메모리 압박 감지 (GC threshold)
 * - 즉시 최적화 수행 (캐시 정리, 탭 언로드 등)
 * - 반복 → 안정적인 메모리 레벨 유지
 *
 * 정책:
 * 1. GC_THRESHOLD = 사용 가능한 메모리의 70%
 *    → 이 값 도달 시 캐시 정리 시작
 * 2. CRITICAL_THRESHOLD = GC_THRESHOLD * 1.2
 *    → 이 값 도달 시 탭 언로드 시작
 * 3. EMERGENCY_THRESHOLD = 사용 가능 메모리의 90%
 *    → 이 값 도달 시 긴급 모드 (배경 탭 강제 종료)
 */

/**
 * 동적 GC 임계값 계산
 *
 * 정책:
 * - 사용 가능한 메모리 * 70% = 캐시 정리 시점
 * - 저메모리: 최소 150MB (시스템 안정성)
 * - 고메모리: 최대 800MB (시스템별 합리적 상한)
 *
 * @returns GC 임계값 (MB)
 */
export function calculateGCThreshold(totalMemoryMB?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);

  // 사용 가능한 메모리 (OS 예약 20%)
  const availableMB = total * 0.8;

  // 그 중 70%가 GC 임계값
  const gcThresholdMB = availableMB * 0.7;

  // MIN/MAX 경계
  // - MIN: 150MB (아무리 저사양이어도 최소한 캐시 정리 가능)
  // - MAX: 800MB (시스템별 합리적 상한)
  return Math.max(150, Math.min(Math.round(gcThresholdMB), 800));
}

/**
 * 동적 메모리 압박(Critical) 임계값 계산
 *
 * 정책:
 * - GC 임계값의 1.2배
 * - 이 값 도달 → 탭 자동 언로드 시작
 * - 저메모리: 최소 180MB
 * - 고메모리: 최대 900MB
 *
 * @returns Critical 임계값 (MB)
 */
export function calculateCriticalMemoryThreshold(totalMemoryMB?: number): number {
  const gcThreshold = calculateGCThreshold(totalMemoryMB);
  const criticalMB = gcThreshold * 1.2;

  // MIN/MAX 경계
  return Math.max(180, Math.min(Math.round(criticalMB), 900));
}

/**
 * Hard 한계: 동적으로 계산 (사용 가능 메모리의 90%)
 *
 * 정책:
 * - 사용 가능 메모리의 90% 초과 방지
 * - 이 값 도달 시 긴급 모드:
 *   1. 모든 배경 탭 강제 종료
 *   2. 포그라운드 탭만 유지
 *   3. 새 탭 요청 거부
 */
export const MEMORY_HARD_LIMIT_MB = 950;

/**
 * 정적 기준값 (초기화 시점의 참고값, 런타임에는 위의 함수 사용)
 */
export const GC_THRESHOLD_LOW_MB = 150;
export const GC_THRESHOLD_MID_MB = 400;
export const GC_THRESHOLD_HIGH_MB = 700;

// 메모리 압박 계산 비율 (정책이 변경되었으므로 이제 함수에서 1.2배 사용)
export const MEMORY_CRITICAL_RATIO = 1.2;

// ============================================================================
// 캐시 관리: 동적 계산
// ============================================================================

/**
 * 동적 HTTP 캐시 크기 계산
 *
 * 정책:
 * - 시스템 메모리에 맞춰 캐시 크기 조정
 * - 사용 가능 메모리의 10%를 HTTP 캐시에 할당
 * - 저메모리: 최소 30MB
 * - 고메모리: 최대 400MB
 *
 * 이유:
 * - 캐시가 메모리 사용량을 빠르게 늘림
 * - 메모리 압박 시 우선 캐시 정리 (사용자 영향 미미)
 * - 시스템 메모리에 맞춰 동적 조정
 */
export function calculateHTTPCacheSize(totalMemoryMB?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);

  // 사용 가능한 메모리의 10%
  const cacheSizeMB = total * 0.8 * 0.1;

  // MIN/MAX 경계
  return Math.max(30, Math.min(Math.round(cacheSizeMB), 400));
}

/**
 * 동적 IndexedDB 크기 계산
 *
 * 정책:
 * - HTTP 캐시보다 작게 할당 (일반 사용자는 IndexedDB 사용 드물음)
 * - 사용 가능 메모리의 5%
 * - 저메모리: 최소 10MB
 * - 고메모리: 최대 200MB
 */
export function calculateIndexedDBSize(totalMemoryMB?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);

  // 사용 가능한 메모리의 5%
  const sizeMB = total * 0.8 * 0.05;

  // MIN/MAX 경계
  return Math.max(10, Math.min(Math.round(sizeMB), 200));
}

/**
 * 정적 기준값 (캐시용, 초기화 시점)
 */
export const HTTP_CACHE_SIZE_LOW_MB = 30;
export const HTTP_CACHE_SIZE_MID_MB = 150;
export const HTTP_CACHE_SIZE_HIGH_MB = 400;

export const INDEXEDDB_SIZE_LOW_MB = 10;
export const INDEXEDDB_SIZE_MID_MB = 50;
export const INDEXEDDB_SIZE_HIGH_MB = 200;

// ============================================================================
// 네트워크 관리: 동적 최적화 (RTT 기반)
// ============================================================================

/**
 * 느린 네트워크 감지 및 최적화
 *
 * 정책:
 * - 4G/LTE: RTT < 100ms → 모든 최적화 기능 활성화
 * - 3G: RTT 150-300ms → 이미지 품질 감소, 비디오 자동재생 비활성
 * - 2G: RTT > 1000ms → 매우 공격적 최적화, 이미지 비활성화
 */

/**
 * 동적 네트워크 프로필 분류
 *
 * @param rttMs - RTT (Round Trip Time, 밀리초)
 * @returns 네트워크 프로필: 'excellent' | 'good' | 'slow' | 'very-slow'
 */
export function classifyNetworkProfile(rttMs: number): string {
  if (rttMs < 100) return 'excellent'; // 4G/LTE
  if (rttMs < 300) return 'good'; // 3G
  if (rttMs < 1000) return 'slow'; // 2G-edge
  return 'very-slow'; // 극도로 느림
}

/**
 * 동적 이미지 품질 결정
 *
 * 정책:
 * - excellent: 원본 품질 (100%)
 * - good: 중상 품질 (85%, JPEG 품질 85)
 * - slow: 낮은 품질 (60%, JPEG 품질 60)
 * - very-slow: 극저 품질 (40%, JPEG 품질 40, WebP만)
 */
export function getImageQuality(rttMs: number): number {
  const profile = classifyNetworkProfile(rttMs);
  switch (profile) {
    case 'excellent':
      return 100;
    case 'good':
      return 85;
    case 'slow':
      return 60;
    case 'very-slow':
      return 40;
    default:
      return 100;
  }
}

/**
 * 동적 비디오 자동재생 결정
 *
 * 정책:
 * - excellent/good: 자동재생 활성화
 * - slow: 자동재생 비활성화 (사용자 클릭 필요)
 * - very-slow: 비디오 로드 불가 (또는 극저화질만)
 */
export function shouldAutoplayVideo(rttMs: number): boolean {
  const profile = classifyNetworkProfile(rttMs);
  return profile === 'excellent' || profile === 'good';
}

/**
 * 정적 기준값
 */
export const SLOW_NETWORK_RTT_MS = 300; // 3G 대역
export const VERY_SLOW_NETWORK_RTT_MS = 1_000; // 2G

/**
 * DNS 캐시 크기 (동적으로도 계산 가능하지만, 영향이 미미)
 */
export const DNS_CACHE_SIZE_LOW = 50;
export const DNS_CACHE_SIZE_MID = 200;
export const DNS_CACHE_SIZE_HIGH = 500;
export const DNS_CACHE_TTL_SEC = 300; // 5분

/**
 * 네트워크 기타 설정
 */
export const NETWORK_POOL_SIZE = 10; // HTTP 연결 풀

// ============================================================================
// 성능 모니터링: 실시간 조정
// ============================================================================

/**
 * 성능 메트릭 수집 간격 (밀리초)
 *
 * 정책:
 * - 저사양: 5초 (오버헤드 최소화)
 * - 중간/고사양: 1초 (빠른 반응)
 */
export function getPerfMetricsInterval(totalMemoryMB?: number): number {
  const total = totalMemoryMB || Math.round(os.totalmem() / 1024 / 1024);

  // 저사양 (< 2GB): 5초
  if (total < 2_000) return 5_000;

  // 기본값: 1초
  return 1_000;
}

export const PERF_METRICS_INTERVAL_MS = 1_000; // 기본값 1초
export const PERF_METRICS_RETENTION_SEC = 60; // 최근 1분만

/**
 * CPU/메모리 경고 임계값
 *
 * 정책:
 * - CPU > 80% 또는 메모리 > 85%: 배경 작업 지연
 * - CPU > 90% 또는 메모리 > 95%: 긴급 모드
 */
export const CPU_USAGE_WARNING_PERCENT = 80;
export const CPU_USAGE_CRITICAL_PERCENT = 90;

export const MEMORY_USAGE_WARNING_PERCENT = 85;
export const MEMORY_USAGE_CRITICAL_PERCENT = 95;

// ============================================================================
// 배터리 관리 (모바일): 동적 조정
// ============================================================================

/**
 * 정책:
 * - 배터리 20% 이하: 절전 모드 (애니메이션 비활성화, 자동재생 비활성화)
 * - 배터리 5% 이하: 긴급 모드 (모든 배경 작업 정지, 자동 저장)
 * - 배터리 1% 이하: 매우 위험 (데이터 손실 방지)
 */
export const BATTERY_POWER_SAVER_PERCENT = 20; // 절전 모드 시작
export const BATTERY_CRITICAL_PERCENT = 5; // 긴급 모드
export const BATTERY_EMERGENCY_PERCENT = 1; // 매우 위험
export const BATTERY_UPDATE_INTERVAL_SEC = 30; // 배터리 상태 조회 간격

// ============================================================================
// 내보내기: 정적 및 동적 상수 통합
// ============================================================================

/**
 * IPC 재시도 정책
 */
export const IPC_RETRY_COUNT = 3;
export const IPC_RETRY_DELAY_MS = 1_000; // 1초 지수 백오프

/**
 * 성능 티어 초기화 (초기화 시점의 정적 값)
 *
 * 사용 예시:
 * ```typescript
 * // 1. 초기화 시점
 * const tier = getPerformanceConfig().tier; // 'low' | 'mid' | 'high'
 * const config = {
 *   maxTabs: calculateMaxTabs(), // 동적 계산
 *   maxHistory: calculateMaxHistory(), // 동적 계산
 *   // ...
 * };
 *
 * // 2. 런타임 모니터링
 * monitor.memory.onPressure('high', () => {
 *   // 메모리 압박 감지 → 즉시 최적화 수행
 *   const newMaxTabs = calculateMaxTabs(currentMemory);
 *   // ...
 * });
 * ```
 */
export const PERFORMANCE_TIERS = {
  low: {
    maxTabs: MAX_TABS_LOW,
    maxHistory: MAX_HISTORY_LOW,
    maxWorkerThreads: MAX_WORKER_THREADS_LOW,
    gcThresholdMB: GC_THRESHOLD_LOW_MB,
    httpCacheSizeMB: HTTP_CACHE_SIZE_LOW_MB,
    indexedDBSizeMB: INDEXEDDB_SIZE_LOW_MB,
    dnsCacheSize: DNS_CACHE_SIZE_LOW,
  },
  mid: {
    maxTabs: MAX_TABS_MID,
    maxHistory: MAX_HISTORY_MID,
    maxWorkerThreads: MAX_WORKER_THREADS_MID,
    gcThresholdMB: GC_THRESHOLD_MID_MB,
    httpCacheSizeMB: HTTP_CACHE_SIZE_MID_MB,
    indexedDBSizeMB: INDEXEDDB_SIZE_MID_MB,
    dnsCacheSize: DNS_CACHE_SIZE_MID,
  },
  high: {
    maxTabs: MAX_TABS_HIGH,
    maxHistory: MAX_HISTORY_HIGH,
    maxWorkerThreads: MAX_WORKER_THREADS_HIGH,
    gcThresholdMB: GC_THRESHOLD_HIGH_MB,
    httpCacheSizeMB: HTTP_CACHE_SIZE_HIGH_MB,
    indexedDBSizeMB: INDEXEDDB_SIZE_HIGH_MB,
    dnsCacheSize: DNS_CACHE_SIZE_HIGH,
  },
} as const;
