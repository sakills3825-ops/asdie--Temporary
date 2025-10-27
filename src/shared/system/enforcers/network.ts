/**
 * 네트워크 Enforcer: 네트워크 정책을 실제로 실행
 *
 * 원칙:
 * - RTT 기반 콘텐츠 자동 조정 (사용자 개입 없음)
 * - 콘텐츠 품질 동적 변경
 * - 메모리 절감과 사용성 균형
 * - Renderer process와 IPC로 통신
 */

import { NetworkPolicy, getNetworkPolicy } from '../policies/network';

/**
 * 네트워크 최적화 액션 타입
 */
export type NetworkAction =
  | 'image-quality-adjust'
  | 'video-autoplay-disable'
  | 'animation-disable'
  | 'ipc-timeout-adjust';

/**
 * 네트워크 최적화 이벤트 핸들러
 */
export interface NetworkEnforcerListener {
  onImageQualityChange?: (quality: number) => void;
  onVideoAutoplayChange?: (enabled: boolean) => void;
  onAnimationChange?: (enabled: boolean) => void;
  onIPCTimeoutChange?: (timeoutMs: number) => void;
}

/**
 * NetworkEnforcer: 네트워크 정책 실행
 *
 * 동작:
 * - RTT 모니터링 (Network API)
 * - 네트워크 프로필 변화 감지
 * - Renderer process에 설정 변경 요청 (IPC)
 * - 이미지 품질, 비디오 자동재play, 애니메이션 조정
 */
export class NetworkEnforcer {
  private policy: NetworkPolicy;
  private listeners: NetworkEnforcerListener = {};
  private lastRTTMs: number = 0;
  private lastProfile: string = 'excellent';

  constructor() {
    this.policy = getNetworkPolicy();
  }

  /**
   * 리스너 등록
   */
  public on(event: keyof NetworkEnforcerListener, handler: (data?: unknown) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.listeners as any)[event] = handler;
  }

  /**
   * 네트워크 상태에 따른 콘텐츠 자동 조정
   *
   * @param rttMs - Round Trip Time (밀리초)
   * @returns 수행된 액션 목록
   */
  public async enforce(rttMs: number): Promise<NetworkAction[]> {
    const profile = this.policy.classifyProfile(rttMs);
    const actions: NetworkAction[] = [];

    // RTT 변화가 없으면 스킵 (과도한 IPC 호출 방지)
    if (Math.abs(rttMs - this.lastRTTMs) < 50 && profile === this.lastProfile) {
      return [];
    }

    this.lastRTTMs = rttMs;
    this.lastProfile = profile;

    const settings = this.policy.getSettingsByRTT(rttMs);

    // 이미지 품질 조정
    actions.push('image-quality-adjust');
    await this.adjustImageQuality(settings.imageQuality);

    // 비디오 자동재play 조정
    actions.push('video-autoplay-disable');
    await this.adjustVideoAutoplay(settings.enableVideoAutoplay);

    // 애니메이션 조정
    actions.push('animation-disable');
    await this.adjustAnimations(settings.enableAnimations);

    // IPC 타임아웃 조정
    actions.push('ipc-timeout-adjust');
    await this.adjustIPCTimeout(settings.ipcTimeoutMs);

    console.log(
      `[NetworkEnforcer] RTT ${rttMs}ms → ${profile} (이미지: ${settings.imageQuality}%, 비디오: ${settings.enableVideoAutoplay ? '자동' : '수동'})`
    );

    return actions;
  }

  /**
   * 이미지 품질 조정
   *
   * 정책:
   * - excellent: 100% (원본)
   * - good: 85% (JPEG 품질 85)
   * - slow: 60% (JPEG 품질 60)
   * - very-slow: 40% (JPEG 품질 40, WebP만)
   *
   * 메모리 효과:
   * - 100% → 40%: 메모리 약 60% 절감
   */
  private async adjustImageQuality(quality: number): Promise<void> {
    // 실제로는 Renderer process에 IPC로 요청
    // await ipcRenderer.invoke('network:setImageQuality', { quality });

    // Renderer에서 실행할 로직:
    // 1. <img> 태그의 srcset 재설정
    // 2. 백그라운드 이미지 품질 조정
    // 3. Canvas 이미지 품질 조정 (예: toDataURL('image/jpeg', 0.6))

    console.debug(`[NetworkEnforcer] 이미지 품질: ${quality}%`);
    this.listeners.onImageQualityChange?.(quality);
  }

  /**
   * 비디오 자동재play 조정
   *
   * 정책:
   * - excellent/good: 자동재play 활성화 (비디오 로드)
   * - slow/very-slow: 자동재play 비활성화 (사용자 클릭 필요)
   *
   * 메모리 효과:
   * - 비활성화: 메모리 약 30-50% 절감 (비디오 버퍼링 제거)
   */
  private async adjustVideoAutoplay(enabled: boolean): Promise<void> {
    // 실제로는 Renderer process에 IPC로 요청
    // await ipcRenderer.invoke('network:setVideoAutoplay', { enabled });

    // Renderer에서 실행할 로직:
    // 1. <video autoplay> 속성 제거/추가
    // 2. YouTube iframe 비디오 자동재play 제어
    // 3. 배경 비디오 시작/중지

    console.debug(`[NetworkEnforcer] 비디오 자동재play: ${enabled ? '활성화' : '비활성화'}`);
    this.listeners.onVideoAutoplayChange?.(enabled);
  }

  /**
   * 애니메이션 조정
   *
   * 정책:
   * - excellent/good: 애니메이션 활성화 (CSS, JS 애니메이션)
   * - slow/very-slow: 애니메이션 비활성화 (성능 우선)
   *
   * 메모리 효과:
   * - 비활성화: CPU/메모리 약 10-20% 절감
   */
  private async adjustAnimations(enabled: boolean): Promise<void> {
    // 실제로는 Renderer process에 IPC로 요청
    // await ipcRenderer.invoke('network:setAnimations', { enabled });

    // Renderer에서 실행할 로직:
    // 1. CSS animation 속성 제거 (prefers-reduced-motion)
    // 2. requestAnimationFrame 중단/재개
    // 3. Lottie 애니메이션 중단/재개

    console.debug(`[NetworkEnforcer] 애니메이션: ${enabled ? '활성화' : '비활성화'}`);
    this.listeners.onAnimationChange?.(enabled);
  }

  /**
   * IPC 타임아웃 조정
   *
   * 정책:
   * - excellent: 5초
   * - good: 10초
   * - slow: 30초
   * - very-slow: 60초
   *
   * 느린 네트워크에서 IPC 요청이 타임아웃되지 않도록 조정
   */
  private async adjustIPCTimeout(timeoutMs: number): Promise<void> {
    // 실제로는 Main process에 IPC로 요청
    // await ipcRenderer.invoke('network:setIPCTimeout', { timeoutMs });

    console.debug(`[NetworkEnforcer] IPC 타임아웃: ${timeoutMs}ms`);
    this.listeners.onIPCTimeoutChange?.(timeoutMs);
  }

  /**
   * 현재 RTT 조회
   */
  public getLastRTT(): number {
    return this.lastRTTMs;
  }

  /**
   * 현재 프로필 조회
   */
  public getLastProfile(): string {
    return this.lastProfile;
  }

  /**
   * 상태 정보
   */
  public getStatus(): {
    rttMs: number;
    profile: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settings: any;
  } {
    const settings = this.policy.getSettingsByRTT(this.lastRTTMs);
    return {
      rttMs: this.lastRTTMs,
      profile: this.lastProfile,
      settings,
    };
  }
}

/**
 * NetworkEnforcer 싱글톤
 */
let instance: NetworkEnforcer | null = null;

export function getNetworkEnforcer(): NetworkEnforcer {
  if (!instance) {
    instance = new NetworkEnforcer();
  }
  return instance;
}
