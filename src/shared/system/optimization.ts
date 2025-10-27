/**
 * 시스템 성능 동적 최적화
 *
 * 모니터링 결과에 따라 실시간으로 시스템 동작을 조정합니다.
 *
 * 계층 분리 완성:
 * - environment.ts: 하드웨어 스펙 (정적)
 * - capabilities.ts: 성능 설정 (초기값)
 * - monitoring.ts: 실시간 메트릭 (측정)
 * - optimization.ts: 대응 액션 (조정, 이 파일)
 */

import {
  BATTERY_POWER_SAVER_PERCENT,
  BATTERY_CRITICAL_PERCENT,
  SLOW_NETWORK_RTT_MS,
  VERY_SLOW_NETWORK_RTT_MS,
} from './constants';
import { MemoryMetrics, NetworkMetrics } from './monitoring';

// ============================================================================
// 적응형 성능 최적화
// ============================================================================

export type PerformanceProfile = 'balanced' | 'performance' | 'powersave';

/**
 * 적응형 성능 최적화
 *
 * 시스템 능력과 현재 상태에 따라 최적 설정을 제공합니다.
 *
 * @example
 * const adaptive = new AdaptivePerformance();
 * const profile = adaptive.getOptimalProfile(cpuUsage, memoryPressure);
 * if (profile === 'powersave') {
 *   // 배경 동기화 연기
 *   // 애니메이션 30fps → 24fps 감소
 * }
 */
export class AdaptivePerformance {
  /**
   * 현재 상태에 맞는 최적 성능 프로필 결정
   *
   * @param cpuUsagePercent CPU 사용률 (0-100)
   * @param memoryPressure 메모리 압력 (0-1)
   * @param batteryPercent 배터리 (0-100, 선택)
   * @returns 권장 프로필
   *
   * 규칙:
   * - CPU > 80% 또는 Memory > 0.8 → 'powersave'
   * - Battery < 20% → 'powersave'
   * - 정상 상황 → 'balanced'
   * - 여유 있음 → 'performance'
   */
  static getOptimalProfile(
    cpuUsagePercent: number,
    memoryPressure: number,
    batteryPercent?: number
  ): PerformanceProfile {
    // 배터리 우선 확인
    if (batteryPercent !== undefined && batteryPercent < BATTERY_POWER_SAVER_PERCENT) {
      return 'powersave';
    }

    // CPU/메모리 기반 판단
    if (cpuUsagePercent > 80 || memoryPressure > 0.8) {
      return 'powersave';
    }

    if (cpuUsagePercent < 30 && memoryPressure < 0.3) {
      return 'performance';
    }

    return 'balanced';
  }

  /**
   * 프로필별 설정값
   */
  static getProfileSettings(profile: PerformanceProfile) {
    const settings = {
      balanced: {
        animationFramerate: 60,
        workerThreads: 'auto',
        cacheSizeMB: 'default',
        videoAutoplay: true,
        imageQuality: 1.0,
      },
      performance: {
        animationFramerate: 60,
        workerThreads: 'max',
        cacheSizeMB: 'default',
        videoAutoplay: true,
        imageQuality: 1.0,
      },
      powersave: {
        animationFramerate: 24,
        workerThreads: 'min',
        cacheSizeMB: '50%',
        videoAutoplay: false,
        imageQuality: 0.7,
      },
    };

    return settings[profile];
  }
}

// ============================================================================
// 메모리 압박 대응
// ============================================================================

/**
 * 메모리 압박 상황에서의 자동 대응
 *
 * 단계별 대응:
 * 1. low: 캐시 모니터링 (조치 불필요)
 * 2. mid: HTTP 캐시 25% 정리
 * 3. high: HTTP 캐시 전체 정리 + 백그라운드 탭 언로드
 *
 * @example
 * const memPressure = new MemoryPressure();
 * memPressure.onLowPressure(() => {
 *   // 정상 상태 복구
 * });
 * memPressure.onHighPressure(() => {
 *   // 탭 자동 언로드
 * });
 */
export class MemoryPressure {
  private callbacks: Map<'low' | 'mid' | 'high', () => void> = new Map();
  private currentLevel: 'low' | 'mid' | 'high' = 'low';

  /**
   * 메모리 압력 업데이트
   *
   * @param metrics 현재 메모리 메트릭
   */
  updatePressure(metrics: MemoryMetrics): void {
    const newLevel = metrics.pressure < 0.5 ? 'low' : metrics.pressure < 0.8 ? 'mid' : 'high';

    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
      this.emit(newLevel);
    }
  }

  /**
   * 메모리 압력 레벨 콜백 등록
   */
  on(level: 'low' | 'mid' | 'high', callback: () => void): void {
    this.callbacks.set(level, callback);
  }

  /**
   * 콜백 발생
   *
   * @internal
   */
  private emit(level: 'low' | 'mid' | 'high'): void {
    const callback = this.callbacks.get(level);
    if (callback) {
      callback();
    }
  }

  /**
   * 권장 대응 액션
   *
   * @example
   * const actions = MemoryPressure.getRecommendedActions('high');
   * for (const action of actions) {
   *   console.log(action); // '캐시 전체 정리', '백그라운드 탭 언로드' 등
   * }
   */
  static getRecommendedActions(level: 'low' | 'mid' | 'high'): string[] {
    const actions = {
      low: [
        // 모니터링만 (조치 불필요)
        '메모리 상태 정상 (저장소 청소 고려)',
      ],
      mid: [
        // 적극적 모니터링
        'HTTP 캐시 25% 정리 (LRU)',
        '이미지 디코드 캐시 10% 정리',
        '배경 탭 메모리 압축',
      ],
      high: [
        // 긴급 대응
        'HTTP 캐시 전체 정리',
        'IndexedDB 사용하지 않는 데이터 정리',
        '백그라운드 탭 강제 언로드',
        '메모리 누수 감지 → 사용자 알림',
      ],
    };

    return actions[level];
  }

  /**
   * 메모리 정리 명령어
   *
   * 실제 정리 구현은 renderer 프로세스에서 수행
   */
  static triggerMemoryCleanup(level: 'low' | 'mid' | 'high'): MemoryCleanupAction[] {
    const actionsMap: Record<'low' | 'mid' | 'high', MemoryCleanupAction[]> = {
      low: [],
      mid: [
        { target: 'httpCache', percentage: 25, priority: 'lru' },
        { target: 'imageDecodeCache', percentage: 10, priority: 'lru' },
      ],
      high: [
        { target: 'httpCache', percentage: 100, priority: 'all' },
        { target: 'indexedDB', percentage: 50, priority: 'lru' },
        { target: 'backgroundTabs', unload: true, priority: 'oldest' },
      ],
    };

    return actionsMap[level];
  }
}

export interface MemoryCleanupAction {
  target: 'httpCache' | 'imageDecodeCache' | 'indexedDB' | 'backgroundTabs';
  percentage?: number;
  unload?: boolean;
  priority: 'lru' | 'oldest' | 'all';
}

// ============================================================================
// 네트워크 적응형 최적화
// ============================================================================

export type NetworkProfile = 'slow-2g' | '2g' | '3g' | '4g';

/**
 * 네트워크 상태에 따른 동적 최적화
 *
 * 네트워크 속도 감지 → 콘텐츠 최적화:
 * - slow-2g: 텍스트만, 타임아웃 60초
 * - 2g: 저화질 이미지, 비디오 비활성화
 * - 3g: 중화질 이미지, 비디오 720p
 * - 4g: 고화질 이미지, 비디오 1080p+
 *
 * @example
 * const networkAdapt = new NetworkAdaptation();
 * networkAdapt.onNetworkChange(metrics, () => {
 *   console.log('네트워크 프로필:', metrics.effectiveType);
 * });
 */
export class NetworkAdaptation {
  private callbacks: Map<NetworkProfile, () => void> = new Map();
  private currentProfile: NetworkProfile = '4g';

  /**
   * 네트워크 메트릭 기반 프로필 결정
   *
   * @param metrics 네트워크 메트릭
   * @returns 네트워크 프로필
   *
   * 규칙:
   * - effectiveType='slow-2g' → 'slow-2g'
   * - effectiveType='2g' OR (RTT > 1000ms) → '2g'
   * - RTT > 200ms AND effectiveType != '4g' → '3g'
   * - 기타 → '4g'
   */
  static classifyNetworkProfile(metrics: NetworkMetrics): NetworkProfile {
    const { effectiveType, rtt } = metrics;

    if (effectiveType === 'slow-2g') {
      return 'slow-2g';
    }

    if (effectiveType === '2g' || rtt > VERY_SLOW_NETWORK_RTT_MS) {
      return '2g';
    }

    if (rtt > SLOW_NETWORK_RTT_MS && effectiveType !== '4g') {
      return '3g';
    }

    return '4g';
  }

  /**
   * 네트워크 변화 감지 시 콜백
   */
  onNetworkChange(metrics: NetworkMetrics, callback: () => void): void {
    const newProfile = NetworkAdaptation.classifyNetworkProfile(metrics);

    if (newProfile !== this.currentProfile) {
      this.currentProfile = newProfile;
      this.callbacks.set(newProfile, callback);
      callback();
    }
  }

  /**
   * 네트워크 프로필별 설정
   *
   * @example
   * const profile = NetworkAdaptation.classifyNetworkProfile(metrics);
   * const settings = NetworkAdaptation.getProfileSettings(profile);
   * if (!settings.enableVideoAutoplay) {
   *   // 비디오 자동재생 비활성화
   * }
   */
  static getProfileSettings(profile: NetworkProfile) {
    const settings = {
      'slow-2g': {
        enableVideoAutoplay: false,
        enableImageLazyLoad: true,
        imageQuality: 0.3, // 30% 품질
        maxImageWidth: 320,
        maxImageHeight: 240,
        requestTimeoutMs: 60_000, // 60초
        maxConcurrentDownloads: 1,
        disableCSS: false,
        disableScripts: false,
        descriptionText: '매우 느린 연결 (2G)',
      },
      '2g': {
        enableVideoAutoplay: false,
        enableImageLazyLoad: true,
        imageQuality: 0.5, // 50% 품질
        maxImageWidth: 480,
        maxImageHeight: 360,
        requestTimeoutMs: 45_000, // 45초
        maxConcurrentDownloads: 2,
        disableCSS: false,
        disableScripts: false,
        descriptionText: '느린 연결 (2G)',
      },
      '3g': {
        enableVideoAutoplay: false,
        enableImageLazyLoad: false,
        imageQuality: 0.8, // 80% 품질
        maxImageWidth: 720,
        maxImageHeight: 540,
        requestTimeoutMs: 30_000, // 30초
        maxConcurrentDownloads: 4,
        disableCSS: false,
        disableScripts: false,
        descriptionText: '중간 속도 (3G)',
      },
      '4g': {
        enableVideoAutoplay: true,
        enableImageLazyLoad: false,
        imageQuality: 1.0, // 100% 품질
        maxImageWidth: 1920,
        maxImageHeight: 1440,
        requestTimeoutMs: 10_000, // 10초
        maxConcurrentDownloads: 10,
        disableCSS: false,
        disableScripts: false,
        descriptionText: '빠른 연결 (4G/LTE)',
      },
    };

    return settings[profile];
  }
}

// ============================================================================
// 배터리 기반 최적화 (모바일)
// ============================================================================

/**
 * 배터리 상태 기반 최적화
 *
 * 배터리 레벨에 따라 화면 주사율, 백그라운드 작업 조정
 *
 * @example
 * const battery = new BatteryOptimization();
 * battery.onBatteryLevelChange(15, () => {
 *   console.log('배터리 절전 모드 활성화!');
 * });
 */
export class BatteryOptimization {
  private callbacks: Map<'ok' | 'warning' | 'critical', () => void> = new Map();
  private currentLevel: 'ok' | 'warning' | 'critical' = 'ok';

  /**
   * 배터리 레벨 업데이트
   *
   * @param batteryPercent 배터리 (0-100)
   * @param isCharging 충전 중 여부
   */
  updateBatteryLevel(batteryPercent: number, isCharging: boolean): void {
    let newLevel: 'ok' | 'warning' | 'critical';

    if (batteryPercent < BATTERY_CRITICAL_PERCENT) {
      newLevel = 'critical';
    } else if (batteryPercent < BATTERY_POWER_SAVER_PERCENT && !isCharging) {
      newLevel = 'warning';
    } else {
      newLevel = 'ok';
    }

    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
      this.emit(newLevel);
    }
  }

  /**
   * 배터리 상태 콜백 등록
   */
  on(level: 'ok' | 'warning' | 'critical', callback: () => void): void {
    this.callbacks.set(level, callback);
  }

  /**
   * 콜백 발생
   *
   * @internal
   */
  private emit(level: 'ok' | 'warning' | 'critical'): void {
    const callback = this.callbacks.get(level);
    if (callback) {
      callback();
    }
  }

  /**
   * 배터리 레벨별 권장 설정
   */
  static getProfileSettings(level: 'ok' | 'warning' | 'critical') {
    const settings = {
      ok: {
        screenRefreshRate: 60,
        enableBackgroundSync: true,
        enablePushNotification: true,
        enableLocationTracking: true,
        animationFramerate: 60,
      },
      warning: {
        screenRefreshRate: 30,
        enableBackgroundSync: false,
        enablePushNotification: true,
        enableLocationTracking: false,
        animationFramerate: 24,
      },
      critical: {
        screenRefreshRate: 1, // 최소 갱신
        enableBackgroundSync: false,
        enablePushNotification: false,
        enableLocationTracking: false,
        animationFramerate: 0, // 애니메이션 비활성화
      },
    };

    return settings[level];
  }
}

// ============================================================================
// 자동 스케일링 (동시작업 수)
// ============================================================================

/**
 * 현재 부하에 따른 동시작업 수 자동 조정
 *
 * 목표:
 * - CPU 부하 < 50% 유지
 * - 메모리 여유 > 20% 유지
 * - 사용자 응답성 우선
 *
 * @example
 * const autoscaler = new AutoScaling(cpuCapabilities);
 * const optimalConcurrency = autoscaler.getOptimalConcurrency(cpuUsage, memoryPressure);
 * workerPool.setMaxWorkers(optimalConcurrency);
 */
export class AutoScaling {
  private baseConcurrency: number;
  private minConcurrency: number = 1;
  private maxConcurrency: number;

  constructor(baseWorkers: number, maxWorkers?: number, minWorkers?: number) {
    this.baseConcurrency = baseWorkers;
    this.maxConcurrency = maxWorkers || baseWorkers * 2;
    this.minConcurrency = minWorkers || 1;
  }

  /**
   * 최적 동시작업 수 계산
   *
   * 알고리즘:
   * 1. CPU 부하 > 70% → 워커 감소 (1초마다 -1)
   * 2. Memory > 0.8 → 워커 감소
   * 3. CPU < 30% AND Memory < 0.3 → 워커 증가 (1초마다 +1)
   * 4. 범위: [minConcurrency, maxConcurrency]
   *
   * @param cpuUsagePercent CPU 사용률
   * @param memoryPressure 메모리 압력
   * @returns 권장 동시작업 수
   */
  getOptimalConcurrency(cpuUsagePercent: number, memoryPressure: number): number {
    let target = this.baseConcurrency;

    // CPU 부하 기반 조정
    if (cpuUsagePercent > 70) {
      target = Math.max(this.minConcurrency, target - 1);
    } else if (cpuUsagePercent < 30 && memoryPressure < 0.3) {
      target = Math.min(this.maxConcurrency, target + 1);
    }

    // 메모리 기반 추가 조정
    if (memoryPressure > 0.8) {
      target = Math.max(this.minConcurrency, target - 2);
    }

    return Math.round(target);
  }

  /**
   * 히스토리 기반 트렌드 분석 (고급)
   *
   * 최근 5개 샘플의 추세를 보고 예측적 조정
   *
   * @param historyPoints 최근 메트릭 배열 (최대 5개)
   * @returns 추세 기반 권장값
   *
   * @example
   * const trend = autoscaler.getPredictiveAdjustment([
   *   { cpu: 40, mem: 0.3 },
   *   { cpu: 50, mem: 0.35 },
   *   { cpu: 65, mem: 0.4 },  // 상승 추세
   * ]);
   * // → 추가 감소 권장
   */
  getPredictiveAdjustment(historyPoints: Array<{ cpu: number; mem: number }>): number {
    if (historyPoints.length < 2) {
      return this.baseConcurrency;
    }

    // 최근 2개 비교: 추세 분석
    const latest = historyPoints[historyPoints.length - 1];
    const prev = historyPoints[historyPoints.length - 2];

    if (!latest || !prev) {
      return this.baseConcurrency;
    }

    const cpuTrend = latest.cpu - prev.cpu;
    const memTrend = latest.mem - prev.mem;

    // 상승 추세 감지 → 더 적극적 감소
    if (cpuTrend > 10 || memTrend > 0.1) {
      return Math.max(this.minConcurrency, this.baseConcurrency - 2);
    }

    // 하강 추세 감지 → 증가 고려
    if (cpuTrend < -10 && memTrend < -0.1) {
      return Math.min(this.maxConcurrency, this.baseConcurrency + 1);
    }

    return this.baseConcurrency;
  }
}
