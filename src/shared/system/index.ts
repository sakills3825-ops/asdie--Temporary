/**
 * src/shared/system 통합 export
 *
 * P1 모든 시스템 최적화 모듈
 */

// ============================================================================
// Constants
// ============================================================================

export * from './constants';

// ============================================================================
// Capabilities (초기 감지)
// ============================================================================

export {
  // GPU
  type GPUTier,
  type GPUCapabilities,
  getGPUCapabilities,
  classifyGPUTier,

  // CPU
  type CPUCapabilities,
  getCPUCapabilities,

  // Memory
  type MemoryTier,
  type MemoryCapabilities,
  getMemoryCapabilities,

  // Network
  type NetworkTier,
  type NetworkCapabilities,
  getNetworkCapabilities,
  createNetworkCapabilities,

  // Battery
  type BatteryCapabilities,
  getBatteryCapabilities,

  // Unified
  type SystemCapabilities,
  getAllCapabilities,
} from './capabilities';

// ============================================================================
// Monitoring (실시간 메트릭)
// ============================================================================

export {
  // CPU Metrics
  type CPUMetrics,
  CPUMonitor,

  // Memory Metrics
  type MemoryMetrics,
  MemoryMonitor,

  // Network Metrics
  type NetworkMetrics,
  NetworkMonitor,

  // Unified Monitor
  SystemMonitor,
} from './monitoring';

// ============================================================================
// Optimization (동적 조정)
// ============================================================================

export {
  // Adaptive Performance
  type PerformanceProfile,
  AdaptivePerformance,

  // Memory Pressure
  type MemoryCleanupAction,
  MemoryPressure,

  // Network Adaptation
  type NetworkProfile,
  NetworkAdaptation,

  // Battery Optimization
  BatteryOptimization,

  // Auto Scaling
  AutoScaling,
} from './optimization';

// ============================================================================
// 사용 예시
// ============================================================================

/**
 * 전체 시스템 모니터링 + 최적화 예제
 *
 * @example
 * import {
 *   getAllCapabilities,
 *   SystemMonitor,
 *   AdaptivePerformance,
 *   MemoryPressure,
 *   NetworkAdaptation,
 * } from '@shared/system';
 *
 * // 1. 초기 능력 감지
 * const capabilities = await getAllCapabilities();
 * console.log('GPU:', capabilities.gpu.tier);     // 'high', 'mid', 'low'
 * console.log('CPU:', capabilities.cpu.cores);    // 8
 * console.log('Memory:', capabilities.memory.tier); // 'high'
 *
 * // 2. 실시간 모니터링 시작
 * const monitor = new SystemMonitor();
 * monitor.start(1000); // 1초 간격
 *
 * // 3. 메모리 압박 대응
 * const memPressure = new MemoryPressure();
 * monitor.memory.onPressure('high', () => {
 *   const actions = MemoryPressure.getRecommendedActions('high');
 *   console.log('메모리 정리:', actions);
 *   memPressure.updatePressure(monitor.memory.getLatest()!);
 *
 *   memPressure.on('high', () => {
 *     console.log('메모리 정리 액션 실행');
 *     const cleanupActions = MemoryPressure.triggerMemoryCleanup('high');
 *     // renderer에 전달: 캐시 정리, 탭 언로드
 *   });
 * });
 *
 * // 4. 네트워크 적응형 최적화
 * const networkAdapt = new NetworkAdaptation();
 * monitor.network.addEventListener('change', () => {
 *   const metrics = monitor.network.getMetrics();
 *   if (!metrics) return;
 *
 *   networkAdapt.onNetworkChange(metrics, () => {
 *     const profile = NetworkAdaptation.classifyNetworkProfile(metrics);
 *     const settings = NetworkAdaptation.getProfileSettings(profile);
 *
 *     if (!settings.enableVideoAutoplay) {
 *       console.log('네트워크 느림: 비디오 자동재생 비활성화');
 *     }
 *   });
 * });
 *
 * // 5. 성능 프로필 적응형 변경
 * setInterval(() => {
 *   const cpuMetrics = monitor.cpu.getLatest();
 *   const memMetrics = monitor.memory.getLatest();
 *   const batteryMetrics = capabilities.battery;
 *
 *   if (cpuMetrics && memMetrics && batteryMetrics) {
 *     const profile = AdaptivePerformance.getOptimalProfile(
 *       cpuMetrics.usagePercent,
 *       memMetrics.pressure,
 *       batteryMetrics.level * 100
 *     );
 *     const settings = AdaptivePerformance.getProfileSettings(profile);
 *     console.log('적응형 성능:', profile, settings);
 *   }
 * }, 5000);
 *
 * // 6. 자동 스케일링
 * const cpuCapabilities = capabilities.cpu;
 * const autoscaler = new AutoScaling(cpuCapabilities.cores);
 *
 * setInterval(() => {
 *   const cpuMetrics = monitor.cpu.getLatest();
 *   const memMetrics = monitor.memory.getLatest();
 *
 *   if (cpuMetrics && memMetrics) {
 *     const optimalConcurrency = autoscaler.getOptimalConcurrency(
 *       cpuMetrics.usagePercent,
 *       memMetrics.pressure
 *     );
 *     console.log('최적 동시작업 수:', optimalConcurrency);
 *     // workerPool.setMaxWorkers(optimalConcurrency);
 *   }
 * }, 1000);
 *
 * // 종료
 * monitor.stop();
 */
