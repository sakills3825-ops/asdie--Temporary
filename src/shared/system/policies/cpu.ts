/**
 * CPU 정책: 부하에 따른 동적 조정
 *
 * 원칙:
 * - CPU 부하 실시간 감지
 * - 배경 작업 우선순위 조정
 * - 메인 스레드 응답성 보호
 */

/**
 * CPU 상태 분류
 */
export type CPUStatus = 'healthy' | 'warning' | 'critical';

/**
 * CPU 정책 규칙
 */
export interface CPURule {
  status: CPUStatus;
  threshold: number; // CPU 사용률 (%)
  actions: string[];
  settings: {
    maxConcurrentTasks: number;
    workerThreads: number;
    enableBackgroundJobs: boolean;
    gcAggressiveness: 'lazy' | 'normal' | 'aggressive';
    description: string;
  };
}

/**
 * CPUPolicy: 부하 기반 동작 조정
 *
 * 정책:
 * - Healthy (< 60%): 정상 운영
 * - Warning (60-80%): 배경 작업 지연
 * - Critical (> 80%): 긴급 모드, 필수 작업만
 */
export class CPUPolicy {
  private rules: CPURule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 정책 규칙 초기화
   */
  private initializeRules(): void {
    this.rules = [
      {
        status: 'healthy',
        threshold: 60,
        actions: [],
        settings: {
          maxConcurrentTasks: 10,
          workerThreads: 4,
          enableBackgroundJobs: true,
          gcAggressiveness: 'lazy',
          description: 'CPU < 60%: 정상 운영, 모든 작업 활성화',
        },
      },
      {
        status: 'warning',
        threshold: 80,
        actions: [
          '⚠️ 배경 작업 대기열 지연 (우선순위 낮음)',
          '🔄 워커 스레드 수 50% 감소',
          '📊 GC 빈도 증가 (메모리 압력 감소)',
        ],
        settings: {
          maxConcurrentTasks: 5,
          workerThreads: 2,
          enableBackgroundJobs: true,
          gcAggressiveness: 'normal',
          description: '60% < CPU < 80%: 배경 작업 지연, 워커 감소',
        },
      },
      {
        status: 'critical',
        threshold: Infinity,
        actions: [
          '🛑 모든 배경 작업 일시 중단',
          '🔴 워커 스레드 최소화 (1-2개만)',
          '💨 공격적 GC 수행',
          '⚡ 메인 스레드 응답성 우선',
        ],
        settings: {
          maxConcurrentTasks: 1,
          workerThreads: 1,
          enableBackgroundJobs: false,
          gcAggressiveness: 'aggressive',
          description: 'CPU > 80%: 긴급 모드, 필수 작업만 수행',
        },
      },
    ];
  }

  /**
   * 현재 CPU 상태 판별
   *
   * @param cpuUsagePercent - 현재 CPU 사용률 (0-100)
   * @returns CPU 상태와 해당 규칙
   */
  public evaluate(cpuUsagePercent: number): {
    status: CPUStatus;
    rule: CPURule;
  } {
    let rule: CPURule = this.rules[0]!; // 기본: healthy

    for (let i = this.rules.length - 1; i >= 0; i--) {
      const currentRule = this.rules[i];
      if (currentRule && cpuUsagePercent >= currentRule.threshold) {
        rule = currentRule;
        break;
      }
    }

    return {
      status: rule.status,
      rule,
    };
  }

  /**
   * CPU 부하 상태별 액션 목록
   */
  public getRecommendedActions(cpuUsagePercent: number): string[] {
    const { rule } = this.evaluate(cpuUsagePercent);
    return rule.actions;
  }

  /**
   * CPU 부하에 따른 최대 동시 작업 수
   */
  public getMaxConcurrentTasks(cpuUsagePercent: number): number {
    const { rule } = this.evaluate(cpuUsagePercent);
    return rule.settings.maxConcurrentTasks;
  }

  /**
   * CPU 부하에 따른 워커 스레드 수
   */
  public getWorkerThreadCount(cpuUsagePercent: number): number {
    const { rule } = this.evaluate(cpuUsagePercent);
    return rule.settings.workerThreads;
  }

  /**
   * 배경 작업 활성화 여부
   */
  public enableBackgroundJobs(cpuUsagePercent: number): boolean {
    const { rule } = this.evaluate(cpuUsagePercent);
    return rule.settings.enableBackgroundJobs;
  }

  /**
   * GC 공격성 수준
   */
  public getGCAggressiveness(cpuUsagePercent: number): 'lazy' | 'normal' | 'aggressive' {
    const { rule } = this.evaluate(cpuUsagePercent);
    return rule.settings.gcAggressiveness;
  }

  /**
   * 모든 규칙 조회
   */
  public getRules(): CPURule[] {
    return this.rules;
  }

  /**
   * 정책 상세 정보
   */
  public getDescription(): string {
    return `
CPUPolicy: CPU 부하 기반 동적 조정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
상태 분류:
  • Healthy: CPU < 60% (정상 운영)
  • Warning: 60% < CPU < 80% (배경 작업 지연)
  • Critical: CPU > 80% (긴급 모드)

각 상태별 조정:
  • 최대 동시 작업: 10 → 5 → 1
  • 워커 스레드: 4 → 2 → 1
  • 배경 작업: On → On → Off
  • GC 공격성: Lazy → Normal → Aggressive

목표:
  → 메인 스레드 응답성 보호
  → CPU 과부하 방지
`;
  }
}

/**
 * CPU 정책 싱글톤 인스턴스
 */
let instance: CPUPolicy | null = null;

export function getCPUPolicy(): CPUPolicy {
  if (!instance) {
    instance = new CPUPolicy();
  }
  return instance;
}
