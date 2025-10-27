/**
 * Enforcer Manager: 모든 Enforcer 통합 인터페이스
 *
 * 목적:
 * - Constants → Policies → Enforcers 완전한 실행 체인
 * - 모든 최적화 정책을 한 곳에서 조정
 * - 여러 정책 간 우선순위 충돌 해결 (e.g., 배터리 > 메모리 > CPU > 네트워크)
 */

import * as os from 'os';
import { getMemoryEnforcer, MemoryEnforcer } from './memory';
import { getNetworkEnforcer, NetworkEnforcer } from './network';
import { getTabEnforcer, TabEnforcer } from './tab';
import { getBackgroundTaskEnforcer, BackgroundTaskEnforcer } from './background-task';

/**
 * 시스템 메트릭스
 */
export interface SystemMetrics {
  // 메모리
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryStatus: 'healthy' | 'warning' | 'critical' | 'emergency';

  // CPU
  cpuUsagePercent: number;
  cpuCoreCount: number;
  cpuStatus: 'healthy' | 'warning' | 'critical';

  // 네트워크
  rttMs: number;
  networkProfile: 'excellent' | 'good' | 'slow' | 'very-slow';

  // 배터리
  batteryPercent: number;
  isOnBattery: boolean;
  batteryStatus: 'healthy' | 'power-saver' | 'critical' | 'emergency';

  // 탭
  activeTabCount: number;
  backgroundTabCount: number;
  totalTabCount: number;

  // 백그라운드 작업
  runningTaskCount: number;
  pausedTaskCount: number;
}

/**
 * Enforcer 액션 집계
 */
export interface EnforcerActions {
  memoryActions: string[];
  networkActions: string[];
  tabActions: string[];
  backgroundTaskActions: string[];
  totalActions: number;
  priority: string; // "배터리 > 메모리 > CPU > 네트워크"
}

/**
 * Enforcer Manager
 *
 * 모든 최적화 정책을 조정하고 실행합니다.
 *
 * 우선순위:
 * 1. Battery (배터리 부족 시 전력 절약 최우선)
 * 2. Memory (메모리 부족 시 캐시 정리 우선)
 * 3. CPU (CPU 부하 시 백그라운드 작업 제한)
 * 4. Network (네트워크 느림 시 콘텐츠 품질 조정)
 *
 * 실행 흐름:
 * 1. 시스템 메트릭 수집
 * 2. 각 Enforcer 정책 평가
 * 3. 우선순위에 따라 액션 수행
 * 4. 상황 모니터링
 */
export class EnforcerManager {
  private memoryEnforcer: MemoryEnforcer;
  private networkEnforcer: NetworkEnforcer;
  private tabEnforcer: TabEnforcer;
  private backgroundTaskEnforcer: BackgroundTaskEnforcer;

  constructor() {
    this.memoryEnforcer = getMemoryEnforcer();
    this.networkEnforcer = getNetworkEnforcer();
    this.tabEnforcer = getTabEnforcer();
    this.backgroundTaskEnforcer = getBackgroundTaskEnforcer();
  }

  /**
   * 모든 Enforcer 실행
   *
   * @param metrics - 시스템 메트릭
   * @returns 수행된 액션들
   */
  public async enforceAll(metrics: SystemMetrics): Promise<EnforcerActions> {
    const actions: EnforcerActions = {
      memoryActions: [],
      networkActions: [],
      tabActions: [],
      backgroundTaskActions: [],
      totalActions: 0,
      priority: '',
    };

    // 우선순위 결정 (배터리 > 메모리 > CPU > 네트워크)
    const priorities: ('battery' | 'memory' | 'cpu' | 'network')[] = [];

    if (metrics.isOnBattery && metrics.batteryPercent < 20) {
      priorities.push('battery');
    }
    if (
      metrics.memoryStatus === 'warning' ||
      metrics.memoryStatus === 'critical' ||
      metrics.memoryStatus === 'emergency'
    ) {
      priorities.push('memory');
    }
    if (metrics.cpuStatus === 'warning' || metrics.cpuStatus === 'critical') {
      priorities.push('cpu');
    }
    if (metrics.networkProfile === 'slow' || metrics.networkProfile === 'very-slow') {
      priorities.push('network');
    }

    actions.priority = priorities.join(' > ');

    // 1. 메모리 Enforcer 실행
    // (메모리 부하가 높으면 배터리 정책보다 우선)
    if (metrics.memoryStatus !== 'healthy') {
      const memoryActions = await this.memoryEnforcer.enforce(metrics.memoryUsedMB);
      actions.memoryActions = memoryActions;
      actions.totalActions += memoryActions.length;
    }

    // 2. 탭 Enforcer 실행 (메모리 최적화의 일부)
    if (
      metrics.memoryStatus === 'warning' ||
      metrics.memoryStatus === 'critical' ||
      metrics.memoryStatus === 'emergency'
    ) {
      const targetMemoryMB = Math.max(700, metrics.memoryTotalMB * 0.8);
      const tabActions = await this.tabEnforcer.optimize(
        metrics.memoryStatus,
        metrics.memoryUsedMB,
        targetMemoryMB
      );
      actions.tabActions = tabActions;
      actions.totalActions += tabActions.length;
    }

    // 3. 배터리 + CPU 기반 백그라운드 작업 제어
    if (metrics.cpuStatus !== 'healthy' || (metrics.isOnBattery && metrics.batteryPercent < 30)) {
      const taskActions = await this.backgroundTaskEnforcer.enforceTaskQueue(
        metrics.cpuUsagePercent,
        metrics.batteryPercent,
        metrics.isOnBattery
      );
      actions.backgroundTaskActions = taskActions;
      actions.totalActions += taskActions.length;
    }

    // 4. 네트워크 Enforcer 실행
    if (metrics.networkProfile === 'slow' || metrics.networkProfile === 'very-slow') {
      const networkActions = await this.networkEnforcer.enforce(metrics.rttMs);
      actions.networkActions = networkActions;
      actions.totalActions += networkActions.length;
    }

    // 로깅
    if (actions.totalActions > 0) {
      console.log(
        `[EnforcerManager] 최적화 실행 (우선순위: ${actions.priority})\n` +
          `  메모리: ${actions.memoryActions.join(', ') || '없음'}\n` +
          `  탭: ${actions.tabActions.join(', ') || '없음'}\n` +
          `  백그라운드: ${actions.backgroundTaskActions.join(', ') || '없음'}\n` +
          `  네트워크: ${actions.networkActions.join(', ') || '없음'}`
      );
    }

    return actions;
  }

  /**
   * 현재 상황 진단
   */
  public async diagnose(metrics: SystemMetrics): Promise<string> {
    const diagnoses: string[] = [];

    // 메모리
    if (metrics.memoryStatus === 'emergency') {
      diagnoses.push('🔴 메모리 긴급 상황: 적극적인 최적화 필요');
    } else if (metrics.memoryStatus === 'critical') {
      diagnoses.push('🟠 메모리 위험: 캐시 정리 및 탭 언로드 중');
    } else if (metrics.memoryStatus === 'warning') {
      diagnoses.push('🟡 메모리 주의: 캐시 정리 중');
    } else {
      diagnoses.push('✅ 메모리 정상');
    }

    // CPU
    if (metrics.cpuStatus === 'critical') {
      diagnoses.push('🔴 CPU 부하 높음: 백그라운드 작업 제한 중');
    } else if (metrics.cpuStatus === 'warning') {
      diagnoses.push('🟡 CPU 부하 중간: 저우선순위 작업 제한 중');
    } else {
      diagnoses.push('✅ CPU 정상');
    }

    // 배터리
    if (metrics.isOnBattery) {
      if (metrics.batteryPercent < 5) {
        diagnoses.push('🔴 배터리 극도로 낮음: 전력 절약 모드 최대');
      } else if (metrics.batteryPercent < 20) {
        diagnoses.push('🟠 배터리 낮음: 전력 절약 중');
      } else if (metrics.batteryPercent < 50) {
        diagnoses.push('🟡 배터리 중간: 전력 절약 중');
      } else {
        diagnoses.push('✅ 배터리 충분');
      }
    } else {
      diagnoses.push('🔌 AC 전원 연결됨');
    }

    // 네트워크
    if (metrics.networkProfile === 'very-slow') {
      diagnoses.push('🔴 네트워크 매우 느림: 콘텐츠 품질 40%로 제한');
    } else if (metrics.networkProfile === 'slow') {
      diagnoses.push('🟡 네트워크 느림: 콘텐츠 품질 60%로 제한');
    } else if (metrics.networkProfile === 'good') {
      diagnoses.push('✅ 네트워크 양호');
    } else {
      diagnoses.push('✅ 네트워크 우수');
    }

    return diagnoses.join('\n');
  }

  /**
   * 상태 요약
   */
  public getSummary(metrics: SystemMetrics): string {
    const memoryUsagePercent = (metrics.memoryUsedMB / metrics.memoryTotalMB) * 100;

    return (
      `메모리: ${metrics.memoryUsedMB.toFixed(0)}/${metrics.memoryTotalMB.toFixed(0)}MB (${memoryUsagePercent.toFixed(1)}%) [${metrics.memoryStatus}]\n` +
      `CPU: ${metrics.cpuUsagePercent.toFixed(1)}% (${metrics.cpuCoreCount} cores) [${metrics.cpuStatus}]\n` +
      `네트워크: ${metrics.rttMs}ms [${metrics.networkProfile}]\n` +
      `배터리: ${metrics.batteryPercent.toFixed(0)}% ${metrics.isOnBattery ? '(배터리 중)' : '(AC 연결)'} [${metrics.batteryStatus}]\n` +
      `탭: ${metrics.activeTabCount} 활성 + ${metrics.backgroundTabCount} 배경 = ${metrics.totalTabCount}개\n` +
      `백그라운드: ${metrics.runningTaskCount} 실행 중, ${metrics.pausedTaskCount} 일시정지`
    );
  }

  /**
   * 메모리 Enforcer 직접 접근 (테스트/디버그용)
   */
  public getMemoryEnforcer(): MemoryEnforcer {
    return this.memoryEnforcer;
  }

  /**
   * 네트워크 Enforcer 직접 접근 (테스트/디버그용)
   */
  public getNetworkEnforcer(): NetworkEnforcer {
    return this.networkEnforcer;
  }

  /**
   * 탭 Enforcer 직접 접근 (테스트/디버그용)
   */
  public getTabEnforcer(): TabEnforcer {
    return this.tabEnforcer;
  }

  /**
   * 백그라운드 작업 Enforcer 직접 접근 (테스트/디버그용)
   */
  public getBackgroundTaskEnforcer(): BackgroundTaskEnforcer {
    return this.backgroundTaskEnforcer;
  }
}

/**
 * EnforcerManager 싱글톤
 */
let instance: EnforcerManager | null = null;

export function getEnforcerManager(): EnforcerManager {
  if (!instance) {
    instance = new EnforcerManager();
  }
  return instance;
}

/**
 * 편의 함수: 모든 enforcer 실행
 */
export async function enforceAll(metrics: SystemMetrics): Promise<EnforcerActions> {
  return getEnforcerManager().enforceAll(metrics);
}

/**
 * 편의 함수: 진단
 */
export async function diagnose(metrics: SystemMetrics): Promise<string> {
  return getEnforcerManager().diagnose(metrics);
}

/**
 * 편의 함수: 요약
 */
export function getSummary(metrics: SystemMetrics): string {
  return getEnforcerManager().getSummary(metrics);
}

/**
 * 편의 함수: Enforcers 초기화 (앱 시작 시 호출)
 *
 * Constants의 동적 값을 기반으로 모든 Enforcer를 초기화합니다.
 * - 시스템 리소스 감지 후 동적 임계값 계산
 * - 각 Enforcer에 해당 값 전달
 * - 싱글톤 인스턴스 생성
 *
 * @example
 * ```typescript
 * // 앱 시작 시
 * await initializeEnforcers();
 *
 * // 이후 Enforcer 사용
 * const manager = getEnforcerManager();
 * await manager.enforceAll(metrics);
 * ```
 */
export async function initializeEnforcers(): Promise<void> {
  console.log('[Enforcers] 초기화 시작...');

  // 현재 시스템 리소스 감지
  const totalMemoryMB = Math.round(os.totalmem() / 1024 / 1024);
  const cpuCoreCount = os.cpus().length;

  // Constants 동적 계산 함수 호출
  const {
    calculateGCThreshold,
    calculateCriticalMemoryThreshold,
    calculateMaxTabs,
    calculateMaxWorkerThreads,
  } = await import('../constants.js');

  const gcThreshold = calculateGCThreshold(totalMemoryMB);
  const criticalThreshold = calculateCriticalMemoryThreshold(totalMemoryMB);
  const maxTabs = calculateMaxTabs(undefined, totalMemoryMB);
  const maxWorkers = calculateMaxWorkerThreads(cpuCoreCount, totalMemoryMB);

  console.log('[Enforcers] 동적 값 계산 완료:');
  console.log(`  총메모리: ${totalMemoryMB}MB`);
  console.log(`  GC 임계값: ${gcThreshold.toFixed(0)}MB`);
  console.log(`  Critical 임계값: ${criticalThreshold.toFixed(0)}MB`);
  console.log(`   최대 탭: ${maxTabs}`);
  console.log(`   최대 워커: ${maxWorkers}`);

  // Enforcer Manager 생성 (싱글톤)
  // 이 시점에서 모든 enforcers가 동적 값으로 초기화됨
  getEnforcerManager();

  console.log('[Enforcers] 초기화 완료!');
}
