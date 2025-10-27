/**
 * 네트워크 정책: RTT 기반 동적 콘텐츠 조정
 *
 * 원칙:
 * - 네트워크 상태 실시간 감지
 * - 콘텐츠 품질 자동 조정
 * - 사용자 경험과 1GB 메모리 사이 균형
 */

/**
 * 네트워크 프로필
 */
export type NetworkProfile = 'excellent' | 'good' | 'slow' | 'very-slow';

/**
 * 네트워크 정책 규칙
 */
export interface NetworkRule {
  profile: NetworkProfile;
  rttThresholdMs: number; // 이 이상의 RTT 시 적용
  settings: {
    imageQuality: number; // 0-100 (%)
    enableVideoAutoplay: boolean;
    videoQuality: 'auto' | 'high' | 'medium' | 'low';
    enableAnimations: boolean;
    ipcTimeoutMs: number;
    description: string;
  };
}

/**
 * NetworkPolicy: RTT 기반 콘텐츠 조정
 *
 * 정책:
 * - Excellent (RTT < 100ms): 모든 기능 활성화
 * - Good (RTT 100-300ms): 중간 품질
 * - Slow (RTT 300-1000ms): 저품질, 비디오 비활성화
 * - Very Slow (RTT > 1000ms): 극저품질, 이미지도 제한
 */
export class NetworkPolicy {
  private rules: NetworkRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 정책 규칙 초기화
   */
  private initializeRules(): void {
    this.rules = [
      {
        profile: 'excellent',
        rttThresholdMs: 0,
        settings: {
          imageQuality: 100,
          enableVideoAutoplay: true,
          videoQuality: 'high',
          enableAnimations: true,
          ipcTimeoutMs: 5_000,
          description: '4G/LTE: 모든 기능 활성화, 최고 품질',
        },
      },
      {
        profile: 'good',
        rttThresholdMs: 100,
        settings: {
          imageQuality: 85,
          enableVideoAutoplay: true,
          videoQuality: 'medium',
          enableAnimations: true,
          ipcTimeoutMs: 10_000,
          description: '3G: 중상 품질, 비디오 자동재생 활성화',
        },
      },
      {
        profile: 'slow',
        rttThresholdMs: 300,
        settings: {
          imageQuality: 60,
          enableVideoAutoplay: false,
          videoQuality: 'low',
          enableAnimations: false,
          ipcTimeoutMs: 30_000,
          description: '2G-Edge: 저품질, 비디오 비활성화, 애니메이션 비활성화',
        },
      },
      {
        profile: 'very-slow',
        rttThresholdMs: 1000,
        settings: {
          imageQuality: 40,
          enableVideoAutoplay: false,
          videoQuality: 'low',
          enableAnimations: false,
          ipcTimeoutMs: 60_000,
          description: '매우 느린 네트워크: 극저품질, 필수 콘텐츠만',
        },
      },
    ];
  }

  /**
   * RTT에 따른 네트워크 프로필 분류
   *
   * @param rttMs - Round Trip Time (밀리초)
   * @returns 네트워크 프로필
   */
  public classifyProfile(rttMs: number): NetworkProfile {
    if (rttMs < 100) return 'excellent';
    if (rttMs < 300) return 'good';
    if (rttMs < 1000) return 'slow';
    return 'very-slow';
  }

  /**
   * 프로필에 따른 설정 조회
   *
   * @param profile - 네트워크 프로필
   * @returns 적용할 설정
   */
  public getSettings(profile: NetworkProfile) {
    const rule = this.rules.find((r) => r.profile === profile);
    if (!rule) {
      // 기본값: excellent
      return this.rules[0]!.settings;
    }
    return rule.settings;
  }

  /**
   * RTT에 따른 설정 조회 (프로필 분류 포함)
   *
   * @param rttMs - Round Trip Time (밀리초)
   * @returns 적용할 설정
   */
  public getSettingsByRTT(rttMs: number) {
    const profile = this.classifyProfile(rttMs);
    return this.getSettings(profile);
  }

  /**
   * 현재 이미지 품질 결정
   */
  public getImageQuality(rttMs: number): number {
    const settings = this.getSettingsByRTT(rttMs);
    return settings.imageQuality;
  }

  /**
   * 비디오 자동재생 여부
   */
  public shouldAutoplayVideo(rttMs: number): boolean {
    const settings = this.getSettingsByRTT(rttMs);
    return settings.enableVideoAutoplay;
  }

  /**
   * 애니메이션 활성화 여부
   */
  public enableAnimations(rttMs: number): boolean {
    const settings = this.getSettingsByRTT(rttMs);
    return settings.enableAnimations;
  }

  /**
   * IPC 타임아웃 결정
   */
  public getIPCTimeout(rttMs: number): number {
    const settings = this.getSettingsByRTT(rttMs);
    return settings.ipcTimeoutMs;
  }

  /**
   * 모든 규칙 조회
   */
  public getRules(): NetworkRule[] {
    return this.rules;
  }

  /**
   * 정책 상세 정보
   */
  public getDescription(): string {
    return `
NetworkPolicy: RTT 기반 동적 콘텐츠 조정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
프로필 분류:
  • Excellent: RTT < 100ms (4G/LTE)
  • Good: RTT 100-300ms (3G)
  • Slow: RTT 300-1000ms (2G-Edge)
  • Very Slow: RTT > 1000ms (극도로 느린)

각 프로필별 조정:
  • 이미지 품질: 40-100%
  • 비디오 자동재생: On/Off
  • 애니메이션: On/Off
  • IPC 타임아웃: 5-60초

목표:
  → 네트워크 상태에 맞춰 자동 최적화
  → 메모리 사용량 제어 (이미지/비디오 스트리밍 제한)
`;
  }
}

/**
 * 네트워크 정책 싱글톤 인스턴스
 */
let instance: NetworkPolicy | null = null;

export function getNetworkPolicy(): NetworkPolicy {
  if (!instance) {
    instance = new NetworkPolicy();
  }
  return instance;
}
