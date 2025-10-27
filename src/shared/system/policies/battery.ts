/**
 * 배터리 정책: 배터리 레벨에 따른 전력 관리
 *
 * 원칙:
 * - 배터리 상태 실시간 감시
 * - 배터리 소모 최소화
 * - 데이터 손실 방지
 *
 * (모바일 및 노트북 배터리 환경 대응)
 */

/**
 * 배터리 상태 분류
 */
export type BatteryStatus = 'healthy' | 'power-saver' | 'critical' | 'emergency';

/**
 * 배터리 정책 규칙
 */
export interface BatteryRule {
  status: BatteryStatus;
  threshold: number; // 배터리 레벨 (%)
  actions: string[];
  settings: {
    enableAnimations: boolean;
    enableVideoAutoplay: boolean;
    enableBackgroundSync: boolean;
    screenBrightness: number; // 0-100 (제안값)
    enableAutoSave: boolean;
    autoSaveIntervalSec: number; // 0 = 비활성화
    description: string;
  };
}

/**
 * BatteryPolicy: 배터리 레벨 기반 전력 관리
 *
 * 정책:
 * - Healthy (> 20%): 정상 운영
 * - Power Saver (5-20%): 전력 절감 모드
 * - Critical (1-5%): 긴급 절전
 * - Emergency (< 1%): 매우 위험, 데이터 보호 우선
 */
export class BatteryPolicy {
  private rules: BatteryRule[] = [];

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
        threshold: 20,
        actions: [],
        settings: {
          enableAnimations: true,
          enableVideoAutoplay: true,
          enableBackgroundSync: true,
          screenBrightness: 100,
          enableAutoSave: false,
          autoSaveIntervalSec: 0,
          description: '배터리 > 20%: 정상 운영, 모든 기능 활성화',
        },
      },
      {
        status: 'power-saver',
        threshold: 5,
        actions: [
          '⚡ 애니메이션 비활성화',
          '📴 비디오 자동재생 비활성화',
          '🔄 백그라운드 동기화 지연',
          '🔅 화면 밝기 70% 감소',
          '💾 자동 저장 활성화 (30초 주기)',
        ],
        settings: {
          enableAnimations: false,
          enableVideoAutoplay: false,
          enableBackgroundSync: false,
          screenBrightness: 30,
          enableAutoSave: true,
          autoSaveIntervalSec: 30,
          description: '5% < 배터리 < 20%: 절전 모드, 기능 제한',
        },
      },
      {
        status: 'critical',
        threshold: 1,
        actions: [
          '🔴 모든 애니메이션 즉시 중단',
          '⏹️ 모든 네트워크 작업 중단',
          '🛑 백그라운드 서비스 중단',
          '💾 자동 저장 빈번화 (10초)',
          '⚠️ 사용자에게 심각한 경고',
        ],
        settings: {
          enableAnimations: false,
          enableVideoAutoplay: false,
          enableBackgroundSync: false,
          screenBrightness: 20,
          enableAutoSave: true,
          autoSaveIntervalSec: 10,
          description: '1% < 배터리 < 5%: 긴급 절전, 필수 기능만',
        },
      },
      {
        status: 'emergency',
        threshold: Infinity,
        actions: [
          '🚨 모든 작업 즉시 중단',
          '💾 강제 저장 수행',
          '🔌 배터리 연결 강제 요구',
          '❌ 새 탭 생성 불가',
          '📵 오프라인 모드로 전환',
        ],
        settings: {
          enableAnimations: false,
          enableVideoAutoplay: false,
          enableBackgroundSync: false,
          screenBrightness: 10,
          enableAutoSave: true,
          autoSaveIntervalSec: 5,
          description: '배터리 < 1%: 매우 위험, 데이터 손실 방지 우선',
        },
      },
    ];
  }

  /**
   * 현재 배터리 상태 판별
   *
   * @param batteryLevel - 배터리 레벨 (0-100)
   * @param isCharging - 충전 중인지 여부
   * @returns 배터리 상태와 해당 규칙
   */
  public evaluate(
    batteryLevel: number,
    isCharging: boolean = false
  ): {
    status: BatteryStatus;
    rule: BatteryRule;
  } {
    // 충전 중이면 healthy 상태
    if (isCharging) {
      return {
        status: 'healthy',
        rule: this.rules[0]!,
      };
    }

    let rule: BatteryRule = this.rules[0]!; // 기본: healthy

    for (let i = this.rules.length - 1; i >= 0; i--) {
      const currentRule = this.rules[i];
      if (currentRule && batteryLevel <= currentRule.threshold) {
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
   * 배터리 상태별 액션 목록
   */
  public getRecommendedActions(batteryLevel: number, isCharging: boolean = false): string[] {
    const { rule } = this.evaluate(batteryLevel, isCharging);
    return rule.actions;
  }

  /**
   * 애니메이션 활성화 여부
   */
  public enableAnimations(batteryLevel: number, isCharging: boolean = false): boolean {
    const { rule } = this.evaluate(batteryLevel, isCharging);
    return rule.settings.enableAnimations;
  }

  /**
   * 비디오 자동재생 여부
   */
  public enableVideoAutoplay(batteryLevel: number, isCharging: boolean = false): boolean {
    const { rule } = this.evaluate(batteryLevel, isCharging);
    return rule.settings.enableVideoAutoplay;
  }

  /**
   * 백그라운드 동기화 활성화 여부
   */
  public enableBackgroundSync(batteryLevel: number, isCharging: boolean = false): boolean {
    const { rule } = this.evaluate(batteryLevel, isCharging);
    return rule.settings.enableBackgroundSync;
  }

  /**
   * 화면 밝기 제안값
   */
  public getScreenBrightness(batteryLevel: number, isCharging: boolean = false): number {
    const { rule } = this.evaluate(batteryLevel, isCharging);
    return rule.settings.screenBrightness;
  }

  /**
   * 자동 저장 활성화 여부
   */
  public enableAutoSave(batteryLevel: number, isCharging: boolean = false): boolean {
    const { rule } = this.evaluate(batteryLevel, isCharging);
    return rule.settings.enableAutoSave;
  }

  /**
   * 자동 저장 주기 (초)
   */
  public getAutoSaveInterval(batteryLevel: number, isCharging: boolean = false): number {
    const { rule } = this.evaluate(batteryLevel, isCharging);
    return rule.settings.autoSaveIntervalSec;
  }

  /**
   * 모든 규칙 조회
   */
  public getRules(): BatteryRule[] {
    return this.rules;
  }

  /**
   * 정책 상세 정보
   */
  public getDescription(): string {
    return `
BatteryPolicy: 배터리 레벨 기반 전력 관리
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
상태 분류:
  • Healthy: 배터리 > 20% (정상 운영)
  • Power Saver: 5% < 배터리 < 20% (절전 모드)
  • Critical: 1% < 배터리 < 5% (긴급 절전)
  • Emergency: 배터리 < 1% (매우 위험)

각 상태별 조정:
  • 애니메이션: On → Off
  • 비디오 자동재생: On → Off
  • 백그라운드 동기화: On → Off
  • 화면 밝기: 100% → 10%
  • 자동 저장: Off → 10초 주기

목표:
  → 배터리 수명 최대화
  → 데이터 손실 방지
`;
  }
}

/**
 * 배터리 정책 싱글톤 인스턴스
 */
let instance: BatteryPolicy | null = null;

export function getBatteryPolicy(): BatteryPolicy {
  if (!instance) {
    instance = new BatteryPolicy();
  }
  return instance;
}
