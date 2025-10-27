/**
 * 메모리 Enforcer: 메모리 정책을 실제로 실행
 *
 * 원칙:
 * - 사용자를 제한하지 않음 (탭 강제 종료 X)
 * - 지속적 최적화 (캐시 정리, 배경 탭 지능적 언로드)
 * - 시스템 메모리 능력에 맞춰 자동 조정
 * - 사용자 경험 우선
 */

import { MemoryPolicy, getMemoryPolicy } from '../policies/memory';
import { calculateGCThreshold, calculateCriticalMemoryThreshold } from '../constants';

/**
 * 메모리 최적화 액션 타입
 */
export type MemoryAction = 'cache-clear' | 'background-tabs-unload' | 'gc-aggressive';

/**
 * 메모리 최적화 이벤트 핸들러
 */
export interface MemoryEnforcerListener {
  onCacheClear?: (clearedMB: number) => void;
  onBackgroundTabsUnload?: (unloadedCount: number) => void;
  onGCTrigger?: () => void;
  onWarning?: (message: string) => void;
}

/**
 * MemoryEnforcer: 메모리 정책 실행
 *
 * 동작:
 * 1. Warning 상태 (784-941MB)
 *    → 캐시 정리 (HTTP, IndexedDB)
 *    → 이미지 캐시 정리
 *    → 불필요한 데이터 제거
 *    → 사용자에게 알림 없음 (백그라운드에서 조용히 실행)
 *
 * 2. Critical 상태 (941-950MB)
 *    → Warning의 모든 액션 수행
 *    → 배경 탭 지능적 언로드 (가장 오래된 탭부터)
 *    → 하지만 절대 강제 종료 아님, 복구 가능함
 *
 * 3. Emergency 상태 (> 950MB)
 *    → 긴급 모드 (거의 발생하지 않아야 함)
 *    → 적극적 정리
 *    → 사용자에게 심각한 경고
 */
export class MemoryEnforcer {
  private policy: MemoryPolicy;
  private listeners: MemoryEnforcerListener = {};
  private isEnforcing = false;
  private criticalThresholdMBValue: number;
  private hardLimitMBValue: number;

  constructor(criticalThresholdMB?: number, hardLimitMB?: number) {
    // 동적 값 또는 전달된 값 사용
    const finalGcThreshold = calculateGCThreshold();
    const finalCriticalThreshold = criticalThresholdMB ?? calculateCriticalMemoryThreshold();
    const finalHardLimit = hardLimitMB ?? 950;

    // 클래스 필드에 저장
    this.criticalThresholdMBValue = finalCriticalThreshold;
    this.hardLimitMBValue = finalHardLimit;

    this.policy = getMemoryPolicy(finalGcThreshold, finalCriticalThreshold, finalHardLimit);

    console.log(
      `[MemoryEnforcer] 초기화 완료: GC=${finalGcThreshold.toFixed(0)}MB, ` +
        `Critical=${finalCriticalThreshold.toFixed(0)}MB, HardLimit=${finalHardLimit}MB`
    );
  }

  /**
   * 리스너 등록
   */
  public on(event: keyof MemoryEnforcerListener, handler: (data?: unknown) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.listeners as any)[event] = handler;
  }

  /**
   * 메모리 상태에 따른 자동 최적화 수행
   *
   * @param currentMemoryMB - 현재 메모리 사용량 (MB)
   * @returns 수행된 액션 목록
   */
  public async enforce(currentMemoryMB: number): Promise<MemoryAction[]> {
    if (this.isEnforcing) {
      return [];
    }

    this.isEnforcing = true;
    const actions: MemoryAction[] = [];

    try {
      const { status } = this.policy.evaluate(currentMemoryMB);

      // 상태별 처리
      switch (status) {
        case 'healthy':
          // 정상: 아무것도 하지 않음
          break;

        case 'warning':
          // Warning: 캐시 정리만 (조용히)
          actions.push('cache-clear');
          await this.clearCaches('All caches (HTTP, IndexedDB, images)');
          break;

        case 'critical':
          // Critical: 캐시 정리 + 배경 탭 언로드
          actions.push('cache-clear');
          await this.clearCaches('All caches aggressively');

          // 배경 탭 언로드: 차근차근 (느리게)
          // 사용자가 느끼지 못할 정도로
          actions.push('background-tabs-unload');
          {
            const unloadedCount = await this.unloadBackgroundTabsGently(
              Math.ceil((currentMemoryMB - this.criticalThresholdMBValue) / 30)
            );

            if (unloadedCount > 0) {
              this.notify(
                `💾 메모리 최적화: ${unloadedCount}개 배경 탭 정리 (${currentMemoryMB.toFixed(0)}MB)`
              );
            }
          }
          break;

        case 'emergency': {
          // Emergency: 모든 액션 적극 수행
          actions.push('cache-clear');
          await this.clearCaches('All caches immediately');

          actions.push('background-tabs-unload');
          const emergencyUnloadCount = await this.unloadBackgroundTabsGently(
            Math.ceil((currentMemoryMB - this.hardLimitMBValue) / 25)
          );

          // GC 명시적 수행 (Node.js에서는 불가하지만, 이 시점에서 고려)
          actions.push('gc-aggressive');
          this.triggerGC();

          this.notify(
            `🚨 심각한 메모리 부하: ${currentMemoryMB.toFixed(0)}MB (제한: ${this.hardLimitMBValue}MB), ${emergencyUnloadCount}개 탭 정리`
          );
          break;
        }
      }
    } finally {
      this.isEnforcing = false;
    }

    return actions;
  }

  /**
   * 캐시 정리
   *
   * 주의: 실제 구현에서는 Main process가 이를 처리해야 함
   * (Renderer process에서 접근 불가)
   */
  private async clearCaches(reason: string): Promise<void> {
    // 구현 예시:
    // 1. HTTP 캐시 정리 (LRU)
    // 2. IndexedDB 오래된 데이터 삭제
    // 3. 이미지 캐시 정리
    // 4. 임시 데이터 제거

    console.debug(`[MemoryEnforcer] 캐시 정리: ${reason}`);

    // 실제로는 IPC로 Main process에 요청
    // await ipcRenderer.invoke('memory:clearCaches', { reason });

    // 시뮬레이션: 약 50-200MB 정리된다고 가정
    const clearedMB = Math.random() * 150 + 50;
    this.listeners.onCacheClear?.(clearedMB);
  }

  /**
   * 배경 탭 지능적 언로드 (차근차근, 천천히)
   *
   * 정책:
   * - 가장 오래된 탭부터
   * - 현재 탭은 절대 언로드하지 않음
   * - 자주 방문하는 탭도 우선순위 낮춤
   * - 사용자가 느끼지 못할 정도로 천천히
   *
   * @param targetCount - 언로드할 탭 수 (상한선, 강제하지 않음)
   * @returns 실제 언로드된 탭 수
   */
  private async unloadBackgroundTabsGently(targetCount: number): Promise<number> {
    // 구현 예시:
    // 1. 백그라운드 탭 중에서 가장 오래된 것 선택
    // 2. 해당 탭의 메모리 상태 확인
    // 3. 탭 언로드 (탭 자체는 닫지 않고, 콘텐츠만 언로드)
    // 4. 사용자가 다시 클릭하면 자동으로 다시 로드

    console.debug(`[MemoryEnforcer] 배경 탭 언로드 요청: 최대 ${targetCount}개`);

    // 실제로는 IPC로 Main process에 요청
    // const result = await ipcRenderer.invoke('memory:unloadBackgroundTabs', {
    //   maxCount: targetCount,
    // });
    // return result.unloadedCount;

    // 시뮬레이션: 최대의 50-70% 정도만 언로드
    const actualCount = Math.floor(targetCount * (0.5 + Math.random() * 0.2));
    this.listeners.onBackgroundTabsUnload?.(actualCount);
    return actualCount;
  }

  /**
   * 가비지 컬렉션 명시적 수행 (Node.js)
   *
   * 주의:
   * - Renderer process에서는 직접 호출 불가
   * - Main process에서만 가능
   * - --expose-gc 플래그 필요
   */
  private triggerGC(): void {
    console.debug('[MemoryEnforcer] GC 수동 트리거 (긴급)');

    // 실제로는 Main process가 수행
    // if (global.gc) {
    //   global.gc(false); // full GC
    // }

    this.listeners.onGCTrigger?.();
  }

  /**
   * 사용자 알림
   *
   * 정책:
   * - Warning: 알림 없음 (백그라운드 최적화)
   * - Critical: 선택적 알림 (너무 자주는 아님)
   * - Emergency: 심각한 경고
   */
  private notify(message: string): void {
    console.log(message);
    this.listeners.onWarning?.(message);

    // 실제로는 UI에 표시
    // await ipcRenderer.invoke('ui:showNotification', {
    //   title: '메모리 최적화',
    //   message,
    //   level: 'warning',
    // });
  }

  /**
   * 정책 업데이트 (시스템 리소스 변경 시)
   */
  public updateThresholds(
    gcThresholdMB: number,
    criticalThresholdMB: number,
    hardLimitMB: number
  ): void {
    this.criticalThresholdMBValue = criticalThresholdMB;
    this.hardLimitMBValue = hardLimitMB;
    this.policy.updateThresholds(gcThresholdMB, criticalThresholdMB, hardLimitMB);
  }

  /**
   * 상태 정보
   */
  public getStatus(currentMemoryMB: number): {
    status: string;
    pressure: number;
    canOptimize: boolean;
  } {
    const { status, pressure } = this.policy.evaluate(currentMemoryMB);
    return {
      status,
      pressure,
      canOptimize: status !== 'healthy' && !this.isEnforcing,
    };
  }
}

/**
 * MemoryEnforcer 싱글톤
 */
let instance: MemoryEnforcer | null = null;

export function getMemoryEnforcer(
  criticalThresholdMB?: number,
  hardLimitMB?: number
): MemoryEnforcer {
  if (!instance) {
    instance = new MemoryEnforcer(criticalThresholdMB, hardLimitMB);
  }
  return instance;
}
