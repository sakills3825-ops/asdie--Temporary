/**
 * 메모리 정책: 시스템 메모리 능력에 맞춘 동적 최적화
 *
 * 원칙:
 * - 사용자를 제한하지 않음 (나쁜 UX)
 * - 지속적 최적화로 시스템 메모리에 맞춰 유지
 * - 각 임계값 도달 시 자동 조치 제안
 */

/**
 * 메모리 상태 분류
 */
export type MemoryStatus = 'healthy' | 'warning' | 'critical' | 'emergency';

/**
 * 메모리 정책 규칙
 */
export interface MemoryRule {
  name: string;
  threshold: number; // MB
  status: MemoryStatus;
  actions: string[]; // 제안되는 액션 목록
  description: string;
}

/**
 * MemoryPolicy: 시스템 메모리 능력에 맞춘 동적 최적화 규칙 정의
 *
 * 정책 흐름:
 * 1. Healthy (< GC 임계값): 정상 운영
 * 2. Warning (GC 임계값 ~ Critical): 캐시 정리 시작
 * 3. Critical (Critical ~ 90% 사용 가능): 탭 언로드 시작
 * 4. Emergency (> 90% 사용 가능): 긴급 모드
 */
export class MemoryPolicy {
  private rules: MemoryRule[] = [];

  constructor(
    private gcThresholdMB: number = 500,
    private criticalThresholdMB: number = 750,
    private hardLimitMB: number = 950
  ) {
    this.initializeRules();
  }

  /**
   * 정책 규칙 초기화
   *
   * 예시 (8GB 시스템):
   * - GC 임계값: 784MB (사용 가능 메모리의 70%)
   * - Critical: 941MB (GC × 1.2)
   * - Hard Limit: 사용 가능 메모리의 90% (절대 한계)
   */
  private initializeRules(): void {
    this.rules = [
      {
        name: 'healthy',
        threshold: this.gcThresholdMB,
        status: 'healthy',
        actions: [],
        description: `메모리 < ${this.gcThresholdMB}MB: 정상 운영, 최적화 불필요`,
      },
      {
        name: 'warning',
        threshold: this.criticalThresholdMB,
        status: 'warning',
        actions: [
          '💾 HTTP 캐시 정리 (LRU 기반)',
          '🗑️ IndexedDB 오래된 데이터 삭제',
          '📸 이미지 캐시 정리',
          '⚠️ 사용자에게 경고 표시',
        ],
        description: `${this.gcThresholdMB}MB < 메모리 < ${this.criticalThresholdMB}MB: 캐시 정리 시작`,
      },
      {
        name: 'critical',
        threshold: this.hardLimitMB,
        status: 'critical',
        actions: [
          '🔴 배경 탭 자동 언로드 (오래된 것부터)',
          '🗑️ 캐시 전체 제거',
          '⚠️ 사용자에게 심각한 경고',
          '🎬 비디오 자동재생 비활성화',
        ],
        description: `${this.criticalThresholdMB}MB < 메모리 < ${this.hardLimitMB}MB: 탭 언로드 시작`,
      },
      {
        name: 'emergency',
        threshold: Infinity,
        status: 'emergency',
        actions: [
          '🚨 모든 배경 탭 강제 종료',
          '📌 포그라운드 탭만 유지',
          '❌ 새 탭 요청 거부',
          '💾 자동 저장 강제 실행',
          '🛑 배경 서비스 중단',
        ],
        description: `메모리 > ${this.hardLimitMB}MB: 긴급 모드, 한계선 초과 방지`,
      },
    ];
  }

  /**
   * 현재 메모리 상태 판별
   *
   * @param memoryUsageMB - 현재 메모리 사용량 (MB)
   * @returns 메모리 상태와 해당 규칙
   */
  public evaluate(memoryUsageMB: number): {
    status: MemoryStatus;
    rule: MemoryRule;
    pressure: number; // 0-1 (0: 건강함, 1: 긴급)
  } {
    // 압박도 계산 (0-1)
    let pressure = 0;
    if (memoryUsageMB > this.gcThresholdMB) {
      pressure = (memoryUsageMB - this.gcThresholdMB) / (this.hardLimitMB - this.gcThresholdMB);
      pressure = Math.min(1, Math.max(0, pressure));
    }

    // 상태 판별
    let rule: MemoryRule = this.rules[0]!; // 기본: healthy

    for (let i = this.rules.length - 1; i >= 0; i--) {
      const currentRule = this.rules[i];
      if (currentRule && memoryUsageMB >= currentRule.threshold) {
        rule = currentRule;
        break;
      }
    }

    return {
      status: rule.status,
      rule,
      pressure,
    };
  }

  /**
   * 메모리 상태별 액션 목록 조회
   */
  public getRecommendedActions(memoryUsageMB: number): string[] {
    const { rule } = this.evaluate(memoryUsageMB);
    return rule.actions;
  }

  /**
   * 모든 규칙 조회
   */
  public getRules(): MemoryRule[] {
    return this.rules;
  }

  /**
   * 정책 업데이트 (시스템 리소스 변경 시)
   */
  public updateThresholds(
    gcThresholdMB: number,
    criticalThresholdMB: number,
    hardLimitMB: number
  ): void {
    this.gcThresholdMB = gcThresholdMB;
    this.criticalThresholdMB = criticalThresholdMB;
    this.hardLimitMB = hardLimitMB;
    this.initializeRules();
  }

  /**
   * 정책 상세 정보
   */
  public getDescription(): string {
    return `
MemoryPolicy: 시스템 메모리에 맞춘 동적 최적화 정책
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
임계값 설정:
  • GC Threshold: ${this.gcThresholdMB}MB (캐시 정리 시작)
  • Critical: ${this.criticalThresholdMB}MB (탭 언로드 시작)
  • Hard Limit: ${this.hardLimitMB}MB (긴급 모드)

운영 원칙:
  1. 메모리 < GC: 정상 운영
  2. GC < 메모리 < Critical: 캐시 정리
  3. Critical < 메모리 < Hard Limit: 탭 언로드
  4. 메모리 > Hard Limit: 긴급 모드

목표:
  → 시스템 메모리 능력에 맞춰 최적화하면서 사용자 경험 보호
`;
  }
}

/**
 * 메모리 정책 싱글톤 인스턴스
 */
let instance: MemoryPolicy | null = null;

export function getMemoryPolicy(
  gcThresholdMB?: number,
  criticalThresholdMB?: number,
  hardLimitMB?: number
): MemoryPolicy {
  if (!instance) {
    instance = new MemoryPolicy(gcThresholdMB, criticalThresholdMB, hardLimitMB);
  }
  return instance;
}
