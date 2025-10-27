/**
 * Policies 통합 인덱스
 *
 * 역할:
 * - 모든 정책 클래스를 일관된 인터페이스로 제공
 * - 모니터링 데이터를 정책 규칙으로 변환
 * - Enforcer 계층이 사용할 정책 정보 제공
 * - Constants의 동적 계산 함수 활용
 */

import { MemoryPolicy, getMemoryPolicy } from './memory';
import { NetworkPolicy, getNetworkPolicy } from './network';
import { CPUPolicy, getCPUPolicy } from './cpu';
import { BatteryPolicy, getBatteryPolicy } from './battery';
import { calculateGCThreshold, calculateCriticalMemoryThreshold } from '../constants';

export { MemoryPolicy, getMemoryPolicy } from './memory';
export type { MemoryStatus, MemoryRule } from './memory';

export { NetworkPolicy, getNetworkPolicy } from './network';
export type { NetworkProfile, NetworkRule } from './network';

export { CPUPolicy, getCPUPolicy } from './cpu';
export type { CPUStatus, CPURule } from './cpu';

export { BatteryPolicy, getBatteryPolicy } from './battery';
export type { BatteryStatus, BatteryRule } from './battery';

/**
 * PolicyManager: 모든 정책을 통합 관리
 *
 * 용도:
 * - Enforcer에서 정책 조회
 * - 모니터링 데이터를 정책으로 변환
 * - Constants의 동적 값을 기반으로 정책 초기화
 * - 일관된 인터페이스 제공
 *
 * 특징:
 * - 동적 임계값 사용 (시스템 리소스 기반)
 * - 명시적 값 전달 가능 (테스트용)
 */
export class PolicyManager {
  private memoryPolicy: MemoryPolicy;
  private networkPolicy: NetworkPolicy;
  private cpuPolicy: CPUPolicy;
  private batteryPolicy: BatteryPolicy;

  constructor(gcThresholdMB?: number, criticalThresholdMB?: number, hardLimitMB?: number) {
    // 동적 값 또는 전달된 값 사용
    // Constants의 동적 계산 함수 활용
    const finalGcThreshold = gcThresholdMB ?? calculateGCThreshold();
    const finalCriticalThreshold = criticalThresholdMB ?? calculateCriticalMemoryThreshold();
    const finalHardLimit = hardLimitMB ?? 950; // 절대 한계는 여전히 950MB

    this.memoryPolicy = getMemoryPolicy(finalGcThreshold, finalCriticalThreshold, finalHardLimit);
    this.networkPolicy = getNetworkPolicy();
    this.cpuPolicy = getCPUPolicy();
    this.batteryPolicy = getBatteryPolicy();

    console.log(
      `[PolicyManager] 메모리 정책 초기화:\n` +
        `  GC 임계값: ${finalGcThreshold.toFixed(0)}MB\n` +
        `  Critical: ${finalCriticalThreshold.toFixed(0)}MB\n` +
        `  Hard Limit: ${finalHardLimit}MB`
    );
  }

  /**
   * 메모리 정책 조회
   */
  public getMemoryPolicy(): MemoryPolicy {
    return this.memoryPolicy;
  }

  /**
   * 네트워크 정책 조회
   */
  public getNetworkPolicy(): NetworkPolicy {
    return this.networkPolicy;
  }

  /**
   * CPU 정책 조회
   */
  public getCPUPolicy(): CPUPolicy {
    return this.cpuPolicy;
  }

  /**
   * 배터리 정책 조회
   */
  public getBatteryPolicy(): BatteryPolicy {
    return this.batteryPolicy;
  }

  /**
   * 모든 정책의 권장 액션 조합
   *
   * 시나리오: 모든 리소스가 동시에 부족할 때
   * - 메모리 부족 + 느린 네트워크 + 높은 CPU + 낮은 배터리
   * → 모든 정책의 액션을 수합하여 우선순위 결정
   */
  public getAllRecommendedActions(
    memoryUsageMB: number,
    rttMs: number,
    cpuUsagePercent: number,
    batteryLevel: number,
    isCharging: boolean = false
  ): {
    memory: string[];
    network: string[];
    cpu: string[];
    battery: string[];
    combined: string[];
  } {
    const memory = this.memoryPolicy.getRecommendedActions(memoryUsageMB);
    const network =
      this.networkPolicy.getSettingsByRTT(rttMs).description !== ''
        ? [
            `🌐 ${this.networkPolicy.classifyProfile(rttMs).toUpperCase()}: ${this.networkPolicy.getSettingsByRTT(rttMs).description}`,
          ]
        : [];
    const cpu = this.cpuPolicy.getRecommendedActions(cpuUsagePercent);
    const battery = this.batteryPolicy.getRecommendedActions(batteryLevel, isCharging);

    // 모든 액션 합치기 (우선순위: 배터리 > 메모리 > CPU > 네트워크)
    const combined = [...battery, ...memory, ...cpu, ...network];

    return {
      memory,
      network,
      cpu,
      battery,
      combined,
    };
  }

  /**
   * 시스템 상태 전체 요약
   */
  public getSummary(
    memoryUsageMB: number,
    rttMs: number,
    cpuUsagePercent: number,
    batteryLevel: number,
    isCharging: boolean = false
  ): string {
    const memStatus = this.memoryPolicy.evaluate(memoryUsageMB).status;
    const netProfile = this.networkPolicy.classifyProfile(rttMs);
    const cpuStatus = this.cpuPolicy.evaluate(cpuUsagePercent).status;
    const batStatus = this.batteryPolicy.evaluate(batteryLevel, isCharging).status;

    return `
╔════════════════════════════════════════════════════════════════╗
║                    시스템 정책 상태 요약                          ║
╠════════════════════════════════════════════════════════════════╣
║ 메모리:   ${memStatus.padEnd(50)} 💾
║ 네트워크: ${netProfile.padEnd(50)} 🌐
║ CPU:     ${cpuStatus.padEnd(50)} ⚙️
║ 배터리:   ${batStatus.padEnd(50)} 🔋
╠════════════════════════════════════════════════════════════════╣
║ 메모리:   ${memoryUsageMB.toFixed(0).padEnd(5)}MB / ${rttMs.toFixed(0).padEnd(5)}MB
║ RTT:      ${rttMs.toFixed(0).padEnd(5)}ms
║ CPU:      ${cpuUsagePercent.toFixed(1).padEnd(5)}%
║ 배터리:   ${batteryLevel.toFixed(1).padEnd(5)}%${isCharging ? ' (충전 중)' : ''}
╚════════════════════════════════════════════════════════════════╝
`;
  }
}

/**
 * PolicyManager 싱글톤
 */
let policyManager: PolicyManager | null = null;

export function getPolicyManager(
  gcThresholdMB?: number,
  criticalThresholdMB?: number,
  hardLimitMB?: number
): PolicyManager {
  if (!policyManager) {
    policyManager = new PolicyManager(gcThresholdMB, criticalThresholdMB, hardLimitMB);
  }
  return policyManager;
}

/**
 * 사용 예시:
 *
 * ```typescript
 * import { getPolicyManager } from '@shared/system/policies';
 *
 * // 정책 관리자 초기화
 * const policyMgr = getPolicyManager(784, 941, 950);
 *
 * // 개별 정책 사용
 * const memPolicy = policyMgr.getMemoryPolicy();
 * const status = memPolicy.evaluate(880);
 * console.log(status.rule.actions); // ['캐시 정리', '탭 언로드', ...]
 *
 * // 모든 정책의 권장 액션
 * const actions = policyMgr.getAllRecommendedActions(
 *   880,   // 메모리
 *   250,   // RTT
 *   82,    // CPU
 *   15,    // 배터리
 *   false  // 충전 중
 * );
 * console.log(actions.combined); // 우선순위순 모든 액션
 *
 * // 시스템 상태 요약
 * console.log(policyMgr.getSummary(880, 250, 82, 15, false));
 * ```
 */
