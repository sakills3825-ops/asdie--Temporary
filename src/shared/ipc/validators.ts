/**
 * IPC 채널 검증 로직
 *
 * Main/Renderer 간 통신 시 채널이 유효한지 런타임에 확인.
 * 잘못된 채널 접근 방지 + 보안
 */

import { IPC_CHANNELS, IpcChannel } from './channels';

/**
 * 모든 유효한 IPC 채널을 Set으로 변환 (성능 최적화)
 * 런타임 검증 시 O(1) 조회 가능
 */
const VALID_IPC_CHANNELS = new Set<string>(Object.values(IPC_CHANNELS));

/**
 * IPC 채널이 유효한지 검증
 *
 * @param channel - 검증할 채널명
 * @returns 유효한 채널이면 true
 *
 * @example
 * if (isValidIpcChannel('browser:navigate')) {
 *   // ✓ 유효한 채널 처리
 * } else {
 *   // ✗ 잘못된 채널 에러 처리
 * }
 */
export function isValidIpcChannel(channel: unknown): channel is IpcChannel {
  return typeof channel === 'string' && VALID_IPC_CHANNELS.has(channel);
}

/**
 * IPC 채널의 도메인 추출
 *
 * @example
 * getIpcDomain('browser:navigateTo')  // returns 'browser'
 * getIpcDomain('tab:createNew')       // returns 'tab'
 * getIpcDomain('notification:show')   // returns 'notification'
 */
export function getIpcDomain(channel: IpcChannel): string {
  const [domain] = channel.split(':');
  return domain || 'unknown';
}

/**
 * IPC 채널의 액션 추출
 *
 * @example
 * getIpcAction('browser:navigateTo')  // returns 'navigateTo'
 * getIpcAction('tab:createNew')       // returns 'createNew'
 */
export function getIpcAction(channel: IpcChannel): string {
  const [, action] = channel.split(':');
  return action || 'unknown';
}

/**
 * 특정 도메인의 채널만 필터링
 *
 * @example
 * getChannelsByDomain('browser') // returns all browser:* channels
 */
export function getChannelsByDomain(domain: string): IpcChannel[] {
  return Object.values(IPC_CHANNELS).filter((channel) =>
    channel.startsWith(`${domain}:`)
  ) as IpcChannel[];
}

/**
 * IPC 채널 별칭 검증
 * 특정 도메인의 채널만 허용해야 할 때 사용
 *
 * @example
 * if (isIpcInDomain(channel, 'browser')) {
 *   // 브라우저 채널만 처리
 * }
 */
export function isIpcInDomain(channel: IpcChannel, domain: string): boolean {
  return getIpcDomain(channel) === domain;
}
