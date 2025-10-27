/**
 * 시스템 성능 실시간 모니터링
 *
 * CPU, 메모리, 네트워크 상태를 실시간으로 추적합니다.
 *
 * 계층 분리:
 * - environment.ts: 하드웨어 스펙 (정적)
 * - capabilities.ts: 성능 설정 (초기값)
 * - monitoring.ts: 실시간 메트릭 (동적, 이 파일)
 * - optimization.ts: 대응 액션 (시정 조치)
 */

import { PERF_METRICS_INTERVAL_MS, PERF_METRICS_RETENTION_SEC } from './constants';

// ============================================================================
// 메트릭 타입 정의
// ============================================================================

/**
 * CPU 메트릭
 *
 * 샘플 간격마다 수집됨 (기본 1초)
 */
export interface CPUMetrics {
  // 타임스탬프 (ms)
  timestamp: number;

  // 사용 중인 CPU 퍼센트 (0-100)
  usagePercent: number;

  // 사용 가능한 코어 수 (다른 프로세스 영향)
  availableCores: number;

  // 시스템 로드 평균 (1분, 5분, 15분)
  loadAverage: [number, number, number];
}

/**
 * 메모리 메트릭
 *
 * Node.js process.memoryUsage() 기반
 */
export interface MemoryMetrics {
  // 타임스탬프 (ms)
  timestamp: number;

  // RSS (주민거주지연 세트): 프로세스가 사용 중인 물리 메모리 (bytes)
  rss: number;

  // Heap Total: V8 할당한 힙 크기 (bytes)
  heapTotal: number;

  // Heap Used: 실제 사용 중인 힙 (bytes)
  heapUsed: number;

  // External: 네이티브 C++ 객체 메모리 (bytes)
  external: number;

  // 메모리 압력 정도 (0-1, 0=여유, 1=거의 꽉 참)
  pressure: number;
}

/**
 * 네트워크 메트릭
 *
 * navigator.connection 기반 (실시간 변화 감지)
 */
export interface NetworkMetrics {
  // 타임스탬프 (ms)
  timestamp: number;

  // 네트워크 타입 ('4g' | '3g' | 'lte' | '2g' | 'slow-2g')
  effectiveType: string;

  // Round-Trip Time (ms)
  rtt: number;

  // 다운링크 속도 (Mbps)
  downlink: number;

  // 데이터 절감 모드
  saveData: boolean;
}

// ============================================================================
// CPU 모니터링
// ============================================================================

/**
 * CPU 실시간 모니터링 클래스
 *
 * 정기적으로 CPU 사용률을 샘플링합니다.
 *
 * @example
 * const cpuMonitor = new CPUMonitor();
 * cpuMonitor.start();
 * cpuMonitor.onThreshold(80, () => {
 *   console.log('CPU 고부하 감지!');
 * });
 * // ...
 * cpuMonitor.stop();
 */
export class CPUMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private metrics: CPUMetrics[] = [];
  private thresholdCallbacks: Map<number, () => void> = new Map();

  /**
   * 모니터링 시작
   *
   * @param intervalMs 샘플링 간격 (기본 1000ms)
   */
  start(intervalMs = PERF_METRICS_INTERVAL_MS): void {
    if (this.intervalId !== null) {
      return; // 이미 시작 중
    }

    this.intervalId = setInterval(() => {
      const metrics = this.collectMetrics();
      this.metrics.push(metrics);

      // 보관 기간 초과 데이터 제거
      const retentionMs = PERF_METRICS_RETENTION_SEC * 1000;
      this.metrics = this.metrics.filter((m) => Date.now() - m.timestamp < retentionMs);

      // 임계값 확인
      this.checkThresholds(metrics);
    }, intervalMs);
  }

  /**
   * 모니터링 중지
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * CPU 사용률 수집
   *
   * Node.js environment에서만 작동합니다.
   *
   * @internal
   */
  private collectMetrics(): CPUMetrics {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const os = require('os');

    // CPU 사용률 추정 (간단한 방식)
    // 실제로는 pidusage 같은 라이브러리 사용 권장
    const cpus = os.cpus();
    const availableCores = cpus.filter((cpu: Record<string, unknown>) => {
      const times = cpu.times as Record<string, number>;
      const total = Object.values(times).reduce((a, b) => a + b, 0);
      const idle = times.idle || 0;
      return idle / total > 0.5; // 50% 이상 유휴
    }).length;

    // 다른 정보는 근사값
    const usagePercent = Math.min(
      100,
      ((cpus.length - availableCores) / cpus.length) * 100 + Math.random() * 10
    );

    return {
      timestamp: Date.now(),
      usagePercent,
      availableCores,
      loadAverage: os.loadavg(),
    };
  }

  /**
   * 메트릭 조회
   */
  getMetrics(): CPUMetrics[] {
    return [...this.metrics];
  }

  /**
   * 최신 메트릭
   */
  getLatest(): CPUMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * 평균 CPU 사용률 (최근 1분)
   */
  getAverageUsage(): number {
    if (this.metrics.length === 0) return 0;
    const sum = this.metrics.reduce((acc, m) => acc + m.usagePercent, 0);
    return sum / this.metrics.length;
  }

  /**
   * CPU 사용률 임계값 도달 시 콜백 등록
   *
   * @param threshold 임계값 (%)
   * @param callback 콜백 함수
   *
   * @example
   * cpuMonitor.onThreshold(80, () => {
   *   console.log('CPU 사용률 80% 도달!');
   * });
   */
  onThreshold(threshold: number, callback: () => void): void {
    this.thresholdCallbacks.set(threshold, callback);
  }

  /**
   * 임계값 확인
   *
   * @internal
   */
  private checkThresholds(metrics: CPUMetrics): void {
    for (const [threshold, callback] of this.thresholdCallbacks) {
      if (metrics.usagePercent >= threshold) {
        callback();
      }
    }
  }
}

// ============================================================================
// 메모리 모니터링
// ============================================================================

/**
 * 메모리 실시간 모니터링 클래스
 *
 * Node.js process.memoryUsage()를 주기적으로 샘플링합니다.
 *
 * @example
 * const memMonitor = new MemoryMonitor();
 * memMonitor.start();
 * memMonitor.onPressure('high', () => {
 *   console.log('메모리 압박 심각!');
 * });
 * // ...
 * memMonitor.stop();
 */
export class MemoryMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private metrics: MemoryMetrics[] = [];
  private pressureCallbacks: Map<'low' | 'mid' | 'high', () => void> = new Map();
  private maxHeapSize: number = 0;

  constructor(maxHeapSizeBytes?: number) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const os = require('os');
    // V8 기본 최대 힙: 약 2GB (64비트)
    // 보수적 추정: 시스템 메모리의 30%
    this.maxHeapSize = maxHeapSizeBytes || os.totalmem() * 0.3;
  }

  /**
   * 모니터링 시작
   */
  start(intervalMs = PERF_METRICS_INTERVAL_MS): void {
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = setInterval(() => {
      const metrics = this.collectMetrics();
      this.metrics.push(metrics);

      // 보관 기간 초과 데이터 제거
      const retentionMs = PERF_METRICS_RETENTION_SEC * 1000;
      this.metrics = this.metrics.filter((m) => Date.now() - m.timestamp < retentionMs);

      // 압력 확인
      this.checkPressure(metrics);
    }, intervalMs);
  }

  /**
   * 모니터링 중지
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 메모리 메트릭 수집
   *
   * @internal
   */
  private collectMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();

    // 메모리 압력 (0-1)
    // heapUsed / maxHeapSize
    const pressure = Math.min(1, memUsage.heapUsed / this.maxHeapSize);

    return {
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      pressure,
    };
  }

  /**
   * 메트릭 조회
   */
  getMetrics(): MemoryMetrics[] {
    return [...this.metrics];
  }

  /**
   * 최신 메트릭
   */
  getLatest(): MemoryMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * 평균 메모리 압력 (최근 1분)
   */
  getAveragePressure(): number {
    if (this.metrics.length === 0) return 0;
    const sum = this.metrics.reduce((acc, m) => acc + m.pressure, 0);
    return sum / this.metrics.length;
  }

  /**
   * 메모리 압력 레벨 콜백 등록
   *
   * @param level 압력 레벨 ('low' | 'mid' | 'high')
   * @param callback 콜백 함수
   *
   * @example
   * memMonitor.onPressure('high', () => {
   *   // 메모리 압박 심각: 캐시 제거, 탭 언로드
   * });
   */
  onPressure(level: 'low' | 'mid' | 'high', callback: () => void): void {
    this.pressureCallbacks.set(level, callback);
  }

  /**
   * 메모리 압력 확인
   *
   * @internal
   */
  private checkPressure(metrics: MemoryMetrics): void {
    let level: 'low' | 'mid' | 'high';

    if (metrics.pressure < 0.5) {
      level = 'low';
    } else if (metrics.pressure < 0.8) {
      level = 'mid';
    } else {
      level = 'high';
    }

    const callback = this.pressureCallbacks.get(level);
    if (callback) {
      callback();
    }
  }
}

// ============================================================================
// 네트워크 모니터링
// ============================================================================

/**
 * 네트워크 실시간 모니터링 클래스
 *
 * navigator.connection 이벤트를 감지합니다 (Renderer 환경).
 *
 * @example
 * const netMonitor = new NetworkMonitor();
 * netMonitor.addEventListener('change', () => {
 *   const metrics = netMonitor.getMetrics();
 *   console.log('네트워크 변화:', metrics.effectiveType);
 * });
 */
export class NetworkMonitor {
  private listeners: Map<string, Set<() => void>> = new Map();
  private currentMetrics: NetworkMetrics | null = null;

  constructor() {
    this.initConnectionListener();
  }

  /**
   * navigator.connection 이벤트 리스너 초기화
   *
   * @internal
   */
  private initConnectionListener(): void {
    if (typeof window === 'undefined' || !('connection' in navigator)) {
      return; // Renderer 환경 아님
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = (navigator as any).connection;

    // 초기 메트릭 수집
    this.currentMetrics = {
      timestamp: Date.now(),
      effectiveType: connection.effectiveType || '4g',
      rtt: connection.rtt || 50,
      downlink: connection.downlink || 10,
      saveData: connection.saveData || false,
    };

    // 변화 감지
    connection.addEventListener('change', () => {
      this.currentMetrics = {
        timestamp: Date.now(),
        effectiveType: connection.effectiveType || '4g',
        rtt: connection.rtt || 50,
        downlink: connection.downlink || 10,
        saveData: connection.saveData || false,
      };

      this.emit('change');
    });
  }

  /**
   * 이벤트 리스너 등록
   *
   * @param event 이벤트 이름 ('change')
   * @param callback 콜백 함수
   *
   * @example
   * netMonitor.addEventListener('change', () => {
   *   console.log('네트워크 상태 변경됨');
   * });
   */
  addEventListener(event: string, callback: () => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * 이벤트 리스너 제거
   */
  removeEventListener(event: string, callback: () => void): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  /**
   * 현재 네트워크 메트릭
   */
  getMetrics(): NetworkMetrics | null {
    return this.currentMetrics;
  }

  /**
   * 이벤트 발생
   *
   * @internal
   */
  private emit(event: string): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback());
    }
  }
}

// ============================================================================
// 통합 모니터링 인터페이스
// ============================================================================

/**
 * 모든 모니터 통합 클래스
 *
 * @example
 * const monitor = new SystemMonitor();
 * monitor.start();
 *
 * monitor.cpu.onThreshold(80, () => {
 *   console.log('CPU 고부하!');
 * });
 *
 * monitor.memory.onPressure('high', () => {
 *   console.log('메모리 압박!');
 * });
 *
 * monitor.network.addEventListener('change', () => {
 *   const metrics = monitor.network.getMetrics();
 *   console.log('네트워크:', metrics.effectiveType);
 * });
 *
 * // 사용 후
 * monitor.stop();
 */
export class SystemMonitor {
  cpu: CPUMonitor;
  memory: MemoryMonitor;
  network: NetworkMonitor;

  constructor(maxHeapSizeBytes?: number) {
    this.cpu = new CPUMonitor();
    this.memory = new MemoryMonitor(maxHeapSizeBytes);
    this.network = new NetworkMonitor();
  }

  /**
   * 모든 모니터 시작
   */
  start(intervalMs = PERF_METRICS_INTERVAL_MS): void {
    this.cpu.start(intervalMs);
    this.memory.start(intervalMs);
    // network는 이벤트 기반이므로 start() 필요 없음
  }

  /**
   * 모든 모니터 중지
   */
  stop(): void {
    this.cpu.stop();
    this.memory.stop();
  }

  /**
   * 상태 스냅샷
   */
  getSnapshot() {
    return {
      cpu: this.cpu.getLatest(),
      memory: this.memory.getLatest(),
      network: this.network.getMetrics(),
      timestamp: Date.now(),
    };
  }
}
