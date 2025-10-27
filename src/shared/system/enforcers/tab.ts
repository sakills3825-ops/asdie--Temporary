/**
 * 탭 Enforcer: 탭 개수 동적 조정
 *
 * 원칙:
 * - 사용자가 열고 싶은 탭을 강제로 닫지 않음
 * - 대신 메모리 부하에 따라 배경 탭 자동 지원 (suspension)
 * - 탭을 언로드했을 때 다시 클릭하면 자동으로 복구
 * - 최악의 경우에만 가장 오래된 배경 탭 제거
 */

/**
 * 탭 상태
 */
export type TabState = 'active' | 'background' | 'suspended' | 'discarded';

/**
 * 탭 정보
 */
export interface TabInfo {
  id: number;
  title: string;
  url: string;
  state: TabState;
  memoryUsageMB: number;
  lastAccessedMs: number; // 마지막 접근 시간
  createdMs: number; // 탭 생성 시간
}

/**
 * 탭 최적화 액션 타입
 */
export type TabAction = 'suspend' | 'resume' | 'discard';

/**
 * 탭 최적화 이벤트 핸들러
 */
export interface TabEnforcerListener {
  onTabSuspend?: (tab: TabInfo) => void;
  onTabResume?: (tab: TabInfo) => void;
  onTabDiscard?: (tab: TabInfo) => void;
}

/**
 * TabEnforcer: 탭 동적 관리
 *
 * 정책:
 * 1. Healthy (메모리 < GC 임계값)
 *    → 모든 탭 활성상태 유지
 *
 * 2. Warning (GC < 메모리 < Critical)
 *    → 오래된 배경 탭 자동 Suspend (메모리 해제)
 *    → 탭 재클릭 시 자동 복구
 *
 * 3. Critical (Critical < 메모리 < Hard Limit)
 *    → 더 많은 배경 탭 Suspend
 *    → 필요시 가장 오래된 Suspended 탭 Discard
 *
 * 4. Emergency (메모리 > Hard Limit)
 *    → 공격적으로 탭 Discard
 *    → 포그라운드 탭만 유지
 */
export class TabEnforcer {
  private listeners: TabEnforcerListener = {};
  private tabs: Map<number, TabInfo> = new Map();

  /**
   * 리스너 등록
   */
  public on(event: keyof TabEnforcerListener, handler: (data?: unknown) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.listeners as any)[event] = handler;
  }

  /**
   * 탭 정보 등록
   */
  public registerTab(tab: TabInfo): void {
    this.tabs.set(tab.id, tab);
  }

  /**
   * 탭 업데이트
   */
  public updateTab(tabId: number, updates: Partial<TabInfo>): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      Object.assign(tab, updates);
    }
  }

  /**
   * 탭 제거
   */
  public unregisterTab(tabId: number): void {
    this.tabs.delete(tabId);
  }

  /**
   * 메모리 부하에 따른 탭 자동 조정
   *
   * @param memoryStatus - 메모리 상태: 'healthy' | 'warning' | 'critical' | 'emergency'
   * @param currentMemoryMB - 현재 메모리 사용량
   * @param targetMemoryMB - 목표 메모리 사용량 (예: 800MB)
   * @returns 수행된 액션 목록
   */
  public async optimize(
    memoryStatus: string,
    currentMemoryMB: number,
    targetMemoryMB: number
  ): Promise<TabAction[]> {
    const actions: TabAction[] = [];

    switch (memoryStatus) {
      case 'healthy':
        // 정상: 아무것도 하지 않음
        break;

      case 'warning': {
        // Warning: 오래된 배경 탭 Suspend
        const suspendCount1 = await this.suspendOldestBackgroundTabs(
          1,
          currentMemoryMB,
          targetMemoryMB
        );
        for (let i = 0; i < suspendCount1; i++) {
          actions.push('suspend');
        }
        break;
      }

      case 'critical': {
        // Critical: 더 많은 탭 Suspend 또는 오래된 Suspended 탭 Discard
        const suspendCount2 = await this.suspendOldestBackgroundTabs(
          3,
          currentMemoryMB,
          targetMemoryMB
        );
        for (let i = 0; i < suspendCount2; i++) {
          actions.push('suspend');
        }

        // 필요시 오래된 Suspended 탭 Discard
        if (currentMemoryMB > targetMemoryMB * 1.1) {
          const discardCount = await this.discardOldestSuspendedTabs(2);
          for (let i = 0; i < discardCount; i++) {
            actions.push('discard');
          }
        }
        break;
      }

      case 'emergency': {
        // Emergency: 공격적 조정
        const suspendCount3 = await this.suspendOldestBackgroundTabs(
          5,
          currentMemoryMB,
          targetMemoryMB
        );
        for (let i = 0; i < suspendCount3; i++) {
          actions.push('suspend');
        }

        const discardCount2 = await this.discardOldestSuspendedTabs(5);
        for (let i = 0; i < discardCount2; i++) {
          actions.push('discard');
        }
        break;
      }
    }

    console.log(
      `[TabEnforcer] 메모리 ${memoryStatus}: ${actions.length}개 액션 수행 (${actions.join(', ')})`
    );

    return actions;
  }

  /**
   * 오래된 배경 탭 자동 Suspend
   *
   * 정책:
   * - 현재 활성 탭은 절대 Suspend하지 않음
   * - 배경 탭 중에서 가장 오래 접근하지 않은 탭부터
   * - Suspend된 탭은 메모리 반환 (탭 자체는 유지)
   *
   * @param maxCount - 최대 Suspend 할 탭 수 (상한선)
   * @param currentMemoryMB - 현재 메모리
   * @param targetMemoryMB - 목표 메모리
   * @returns 실제 Suspend된 탭 수
   */
  private async suspendOldestBackgroundTabs(
    maxCount: number,
    currentMemoryMB: number,
    targetMemoryMB: number
  ): Promise<number> {
    // 배경 탭 중에서 Suspended 상태가 아닌 것 찾기
    const backgroundTabs = Array.from(this.tabs.values())
      .filter((tab) => tab.state === 'background' || tab.state === 'active')
      .filter((tab) => tab.state !== 'active') // 활성 탭 제외
      .sort((a, b) => a.lastAccessedMs - b.lastAccessedMs); // 오래 접근하지 않은 것 우선

    let suspendedCount = 0;
    const needToFreeMemory = currentMemoryMB - targetMemoryMB;

    for (const tab of backgroundTabs) {
      if (suspendedCount >= maxCount) break;
      if (needToFreeMemory > 0 && tab.memoryUsageMB * suspendedCount >= needToFreeMemory) break;

      await this.suspendTab(tab);
      suspendedCount++;
    }

    return suspendedCount;
  }

  /**
   * 단일 탭 Suspend
   *
   * 실행 순서:
   * 1. Renderer process에서 탭 콘텐츠 정리
   * 2. 메모리 반환
   * 3. 탭 상태를 'suspended'로 변경
   * 4. 사용자가 다시 클릭하면 자동 복구
   */
  private async suspendTab(tab: TabInfo): Promise<void> {
    // 실제로는 Renderer process에 IPC로 요청
    // await ipcRenderer.invoke('tab:suspend', { tabId: tab.id });

    // Renderer에서 실행할 로직:
    // 1. iframe 내용 정리
    // 2. EventListener 제거
    // 3. WebSocket/EventSource 종료
    // 4. ServiceWorker 정리
    // 5. IndexedDB 임시 데이터 정리

    tab.state = 'suspended';
    console.log(`[TabEnforcer] 탭 Suspend: ${tab.title} (${tab.url})`);
    this.listeners.onTabSuspend?.(tab);
  }

  /**
   * 탭 자동 복구 (사용자가 탭 클릭할 때)
   *
   * 정책:
   * - Suspended 탭을 클릭하면 자동으로 복구
   * - 복구 시간: 100-500ms (사용자가 거의 느끼지 못함)
   */
  public async resumeTab(tabId: number): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.state !== 'suspended') return;

    // 실제로는 Renderer process에 IPC로 요청
    // await ipcRenderer.invoke('tab:resume', { tabId });

    tab.state = 'active';
    tab.lastAccessedMs = Date.now();
    console.log(`[TabEnforcer] 탭 복구: ${tab.title}`);
    this.listeners.onTabResume?.(tab);
  }

  /**
   * 오래된 Suspended 탭 Discard (최악의 경우)
   *
   * 정책:
   * - Suspend 상태의 탭만 Discard
   * - 가장 오래 Suspend된 탭부터
   * - 탭을 완전히 제거 (다시 복구 불가)
   * - 사용자에게 알림
   *
   * @param maxCount - 최대 Discard할 탭 수
   * @returns 실제 Discard된 탭 수
   */
  private async discardOldestSuspendedTabs(maxCount: number): Promise<number> {
    const suspendedTabs = Array.from(this.tabs.values())
      .filter((tab) => tab.state === 'suspended')
      .sort((a, b) => a.createdMs - b.createdMs); // 가장 오래 생성된 탭 우선

    let discardedCount = 0;

    for (const tab of suspendedTabs) {
      if (discardedCount >= maxCount) break;

      await this.discardTab(tab);
      discardedCount++;
    }

    return discardedCount;
  }

  /**
   * 단일 탭 Discard
   *
   * 주의: 탭을 완전히 제거 (히스토리는 유지)
   */
  private async discardTab(tab: TabInfo): Promise<void> {
    // 실제로는 Renderer process에 IPC로 요청
    // await ipcRenderer.invoke('tab:discard', { tabId: tab.id });

    this.tabs.delete(tab.id);
    console.log(`[TabEnforcer] 탭 Discard: ${tab.title} (메모리 ~${tab.memoryUsageMB}MB 반환)`);
    this.listeners.onTabDiscard?.(tab);
  }

  /**
   * 탭 통계
   */
  public getStatistics(): {
    totalTabs: number;
    activeTabs: number;
    backgroundTabs: number;
    suspendedTabs: number;
    discardedTabs: number;
    totalMemoryMB: number;
  } {
    const stats = {
      totalTabs: this.tabs.size,
      activeTabs: 0,
      backgroundTabs: 0,
      suspendedTabs: 0,
      discardedTabs: 0,
      totalMemoryMB: 0,
    };

    for (const tab of this.tabs.values()) {
      switch (tab.state) {
        case 'active':
          stats.activeTabs++;
          break;
        case 'background':
          stats.backgroundTabs++;
          break;
        case 'suspended':
          stats.suspendedTabs++;
          break;
        case 'discarded':
          stats.discardedTabs++;
          break;
      }
      stats.totalMemoryMB += tab.memoryUsageMB;
    }

    return stats;
  }
}

/**
 * TabEnforcer 싱글톤
 */
let instance: TabEnforcer | null = null;

export function getTabEnforcer(): TabEnforcer {
  if (!instance) {
    instance = new TabEnforcer();
  }
  return instance;
}
