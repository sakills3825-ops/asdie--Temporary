/**
 * 백그라운드 작업 Enforcer: CPU/Battery 정책 기반 백그라운드 작업 관리
 *
 * 원칙:
 * - CPU 부하가 높으면 백그라운드 작업 일시정지
 * - 배터리가 낮으면 백그라운드 작업 일시정지
 * - 사용자는 작업이 일시정지되었다는 것을 느끼지 못함 (투명한 관리)
 * - 상황이 호전되면 자동으로 재개
 */

/**
 * 백그라운드 작업 우선순위
 */
export enum TaskPriority {
  CRITICAL = 0, // 항상 실행 (자동저장 등)
  HIGH = 1, // CPU < 70%일 때 실행
  NORMAL = 2, // CPU < 50%일 때 실행
  LOW = 3, // CPU < 30%일 때만 실행
}

/**
 * 백그라운드 작업 상태
 */
export type BackgroundTaskState = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * 백그라운드 작업 정보
 */
export interface BackgroundTaskInfo {
  id: string;
  name: string;
  priority: TaskPriority;
  state: BackgroundTaskState;
  createdMs: number;
  startedMs?: number;
  completedMs?: number;
  estimatedDurationMs: number;
  cpuIntensity: number; // 0-100
  batteryIntensity: number; // 0-100
}

/**
 * 작업 큐 결과
 */
export type QueueAction = 'pause' | 'resume' | 'complete' | 'fail';

/**
 * BackgroundTaskEnforcer 리스너
 */
export interface BackgroundTaskEnforcerListener {
  onTaskPause?: (task: BackgroundTaskInfo) => void;
  onTaskResume?: (task: BackgroundTaskInfo) => void;
  onTaskComplete?: (task: BackgroundTaskInfo) => void;
  onTaskFail?: (task: BackgroundTaskInfo, reason: string) => void;
}

/**
 * BackgroundTaskEnforcer: CPU/Battery 기반 작업 관리
 *
 * 정책:
 * 1. CPU 부하 정책 (priorityThreshold)
 *    - CPU < 30%: LOW 우선순위 작업도 실행
 *    - CPU < 50%: NORMAL 이상 우선순위 작업만 실행
 *    - CPU < 70%: HIGH 이상 우선순위 작업만 실행
 *    - CPU >= 80%: CRITICAL 작업만 실행
 *
 * 2. 배터리 정책
 *    - 배터리 >= 20%: 정상 실행
 *    - 배터리 10-20%: LOW/NORMAL 작업 일시정지
 *    - 배터리 5-10%: HIGH 작업까지 일시정지
 *    - 배터리 < 5%: CRITICAL 작업만 실행
 *
 * 3. 동적 조정
 *    - CPU/Battery 변화를 실시간 감지
 *    - 작업 우선순위에 따라 자동으로 일시정지/재개
 *    - 사용자 경험에 투명함
 */
export class BackgroundTaskEnforcer {
  private listeners: BackgroundTaskEnforcerListener = {};
  private taskQueue: Map<string, BackgroundTaskInfo> = new Map();
  private pausedTasks: Set<string> = new Set();

  /**
   * 리스너 등록
   */
  public on(event: keyof BackgroundTaskEnforcerListener, handler: (data?: unknown) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.listeners as any)[event] = handler;
  }

  /**
   * 작업 등록
   */
  public registerTask(task: BackgroundTaskInfo): void {
    this.taskQueue.set(task.id, task);
  }

  /**
   * 작업 제거
   */
  public unregisterTask(taskId: string): void {
    this.taskQueue.delete(taskId);
    this.pausedTasks.delete(taskId);
  }

  /**
   * CPU/Battery 상태에 따른 작업 큐 최적화
   *
   * @param cpuUsagePercent - CPU 사용률 (0-100)
   * @param batteryPercent - 배터리 (0-100)
   * @param isOnBattery - 배터리로 작동 중인지
   * @returns 수행된 액션 목록
   */
  public async enforceTaskQueue(
    cpuUsagePercent: number,
    batteryPercent: number,
    isOnBattery: boolean
  ): Promise<QueueAction[]> {
    const actions: QueueAction[] = [];

    // CPU 부하에 따른 우선순위 임계값 계산
    const priorityThreshold = this.calculatePriorityThreshold(cpuUsagePercent);

    // 배터리 임계값 계산
    const batteryThreshold = this.calculateBatteryThreshold(batteryPercent, isOnBattery);

    // 모든 작업에 대해 일시정지/재개 결정
    for (const task of this.taskQueue.values()) {
      const isPaused = this.pausedTasks.has(task.id);
      const shouldRun =
        task.priority <= priorityThreshold && // CPU 기준 만족
        task.batteryIntensity <= batteryThreshold; // Battery 기준 만족

      if (shouldRun && isPaused) {
        // 일시정지된 작업 재개
        await this.resumeTask(task);
        actions.push('resume');
      } else if (!shouldRun && !isPaused && task.state === 'running') {
        // 실행 중인 작업 일시정지
        await this.pauseTask(task);
        actions.push('pause');
      }
    }

    if (actions.length > 0) {
      console.log(
        `[BackgroundTaskEnforcer] CPU ${cpuUsagePercent}% | Battery ${batteryPercent}% | ` +
          `${actions.length}개 작업 조정 (${actions.join(', ')})`
      );
    }

    return actions;
  }

  /**
   * CPU 사용률에 따른 우선순위 임계값 계산
   *
   * @param cpuUsagePercent - CPU 사용률 (0-100)
   * @returns 실행 가능한 최대 우선순위 (낮을수록 높은 우선순위)
   */
  private calculatePriorityThreshold(cpuUsagePercent: number): number {
    if (cpuUsagePercent >= 80) {
      return TaskPriority.CRITICAL;
    } else if (cpuUsagePercent >= 70) {
      return TaskPriority.HIGH;
    } else if (cpuUsagePercent >= 50) {
      return TaskPriority.NORMAL;
    } else if (cpuUsagePercent >= 30) {
      return TaskPriority.LOW;
    } else {
      return TaskPriority.LOW; // 모든 우선순위 실행
    }
  }

  /**
   * 배터리 레벨에 따른 작업 강도 임계값 계산
   *
   * @param batteryPercent - 배터리 (0-100)
   * @param isOnBattery - 배터리로 작동 중인지
   * @returns 실행 가능한 최대 배터리 강도 (0-100)
   */
  private calculateBatteryThreshold(batteryPercent: number, isOnBattery: boolean): number {
    if (!isOnBattery) {
      // AC 전원: 배터리 정책 무시
      return 100;
    }

    if (batteryPercent >= 20) {
      return 100; // 모든 작업 실행
    } else if (batteryPercent >= 10) {
      return 50; // 배터리 강도 <= 50인 작업만
    } else if (batteryPercent >= 5) {
      return 20; // 배터리 강도 <= 20인 작업만
    } else {
      return 0; // 배터리 강도 0인 작업만 (자동저장 등)
    }
  }

  /**
   * 작업 일시정지
   *
   * 정책:
   * - 실행 중인 작업만 일시정지
   * - 완료되지 않은 상태에서 대기
   * - 상황 호전 시 자동 재개
   */
  private async pauseTask(task: BackgroundTaskInfo): Promise<void> {
    if (task.state !== 'running') return;

    task.state = 'paused';
    this.pausedTasks.add(task.id);

    console.log(
      `[BackgroundTaskEnforcer] 작업 일시정지: ${task.name} ` +
        `(CPU intensive: ${task.cpuIntensity}%, Battery intensive: ${task.batteryIntensity}%)`
    );

    this.listeners.onTaskPause?.(task);
  }

  /**
   * 작업 재개
   *
   * 정책:
   * - 일시정지된 작업을 실행 상태로 복구
   * - 자동으로 진행됨 (사용자 알림 없음)
   */
  private async resumeTask(task: BackgroundTaskInfo): Promise<void> {
    if (task.state !== 'paused') return;

    task.state = 'running';
    this.pausedTasks.delete(task.id);

    console.log(`[BackgroundTaskEnforcer] 작업 재개: ${task.name}`);

    this.listeners.onTaskResume?.(task);
  }

  /**
   * 작업 완료
   */
  public async completeTask(taskId: string): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (!task) return;

    task.state = 'completed';
    task.completedMs = Date.now();
    this.pausedTasks.delete(taskId);

    console.log(`[BackgroundTaskEnforcer] 작업 완료: ${task.name}`);
    this.listeners.onTaskComplete?.(task);
  }

  /**
   * 작업 실패
   */
  public async failTask(taskId: string, reason: string): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (!task) return;

    task.state = 'failed';
    this.pausedTasks.delete(taskId);

    console.log(`[BackgroundTaskEnforcer] 작업 실패: ${task.name} (${reason})`);
    this.listeners.onTaskFail?.(task, reason);
  }

  /**
   * 큐 통계
   */
  public getStatistics(): {
    totalTasks: number;
    runningTasks: number;
    pausedTasks: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalEstimatedDurationMs: number;
  } {
    const stats = {
      totalTasks: this.taskQueue.size,
      runningTasks: 0,
      pausedTasks: 0,
      pendingTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalEstimatedDurationMs: 0,
    };

    for (const task of this.taskQueue.values()) {
      switch (task.state) {
        case 'running':
          stats.runningTasks++;
          break;
        case 'paused':
          stats.pausedTasks++;
          break;
        case 'pending':
          stats.pendingTasks++;
          break;
        case 'completed':
          stats.completedTasks++;
          break;
        case 'failed':
          stats.failedTasks++;
          break;
      }
      stats.totalEstimatedDurationMs += task.estimatedDurationMs;
    }

    return stats;
  }

  /**
   * 현재 실행 가능한 작업 권장사항
   */
  public getRecommendations(
    cpuUsagePercent: number,
    batteryPercent: number
  ): {
    canRunLowPriority: boolean;
    canRunHighCPU: boolean;
    canRunHighBattery: boolean;
    recommendedAction: string;
  } {
    const cpuThreshold = this.calculatePriorityThreshold(cpuUsagePercent);
    const batteryThreshold = this.calculateBatteryThreshold(batteryPercent, batteryPercent < 100);

    return {
      canRunLowPriority: cpuThreshold >= TaskPriority.LOW,
      canRunHighCPU: cpuThreshold >= TaskPriority.NORMAL,
      canRunHighBattery: batteryThreshold >= 50,
      recommendedAction:
        cpuThreshold < TaskPriority.NORMAL
          ? '백그라운드 작업 제한 중 (CPU 부하 높음)'
          : batteryThreshold < 50
            ? '백그라운드 작업 제한 중 (배터리 낮음)'
            : '정상 작업 처리 중',
    };
  }
}

/**
 * BackgroundTaskEnforcer 싱글톤
 */
let instance: BackgroundTaskEnforcer | null = null;

export function getBackgroundTaskEnforcer(): BackgroundTaskEnforcer {
  if (!instance) {
    instance = new BackgroundTaskEnforcer();
  }
  return instance;
}
