/**
 * EventBus - 앱 내부 이벤트 통신
 *
 * 책임: 느슨한 결합을 위한 이벤트 발행/구독 패턴 구현
 * - 전체 앱에서 사용 가능한 중앙 이벤트 버스
 * - Main, Handler, Service 간의 이벤트 통신
 *
 * 사용 예:
 * - eventBus.on('tab:created', (tabId) => { ... })
 * - eventBus.emit('tab:created', 'tab-123')
 * - eventBus.off('tab:created', listener)
 *
 * SRP 원칙: 오직 이벤트 발행/구독만 담당
 */

import EventEmitter from 'events';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventCallback<T = any> = (data: T) => void;

/**
 * 앱 전역 이벤트 버스
 */
export class EventBus {
  private static instance: EventBus | null = null;
  private logger: ILogger;
  private emitter: EventEmitter;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  private constructor() {
    this.logger = new LoggerImpl('EventBus', LogLevel.DEBUG);
    this.emitter = new EventEmitter();
    // EventEmitter 기본 최대 리스너 수 증가
    this.emitter.setMaxListeners(100);
  }

  /**
   * EventBus 싱글톤 인스턴스 조회
   * 앱 전역에서 하나만 존재
   *
   * @returns EventBus 인스턴스
   */
  public static getInstance(): EventBus {
    if (EventBus.instance === null) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on<T = any>(eventName: string, callback: EventCallback<T>): () => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.emitter.on(eventName, callback as any);

    // 리스너 추적
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);

    this.logger.debug('EventBus: Listener added', {
      module: 'EventBus',
      metadata: { event: eventName, listenerCount: this.getListenerCount(eventName) },
    });

    // 구독 해제 함수 반환
    return () => this.off(eventName, callback);
  }

  /**
   * 이벤트 한 번만 구독
   *
   * @param eventName 이벤트 이름
   * @param callback 콜백 함수
   *
   * @example
   * eventBus.once('app:ready', () => {
   *   console.log('App is ready');
   * });
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public once<T = any>(eventName: string, callback: EventCallback<T>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.emitter.once(eventName, callback as any);

    this.logger.debug('EventBus: One-time listener added', {
      module: 'EventBus',
      metadata: { event: eventName },
    });
  }

  /**
   * 이벤트 구독 해제
   *
   * @param eventName 이벤트 이름
   * @param callback 콜백 함수 (모두 제거하려면 생략)
   *
   * @example
   * eventBus.off('tab:created', callback);
   * eventBus.off('tab:created'); // 모든 리스너 제거
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public off<T = any>(eventName: string, callback?: EventCallback<T>): void {
    if (callback) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.emitter.off(eventName, callback as any);
      this.listeners.get(eventName)?.delete(callback);
    } else {
      this.emitter.removeAllListeners(eventName);
      this.listeners.delete(eventName);
    }

    this.logger.debug('EventBus: Listener removed', {
      module: 'EventBus',
      metadata: { event: eventName, listenerCount: this.getListenerCount(eventName) },
    });
  }

  /**
   * 이벤트 발행
   *
   * @param eventName 이벤트 이름
   * @param data 이벤트 데이터
   *
   * @example
   * eventBus.emit('tab:created', { id: 'tab-123', url: 'https://example.com' });
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public emit<T = any>(eventName: string, data?: T): boolean {
    this.logger.debug('EventBus: Event emitted', {
      module: 'EventBus',
      metadata: { event: eventName, listenerCount: this.getListenerCount(eventName) },
    });

    if (data !== undefined) {
      return this.emitter.emit(eventName, data);
    } else {
      return this.emitter.emit(eventName);
    }
  }

  /**
   * 특정 이벤트의 리스너 개수
   *
   * @param eventName 이벤트 이름
   * @returns 리스너 개수
   */
  public getListenerCount(eventName: string): number {
    return this.emitter.listenerCount(eventName);
  }

  /**
   * 모든 등록된 이벤트 조회
   *
   * @returns 이벤트 이름 배열
   */
  public getEventNames(): string[] {
    return this.emitter.eventNames().map(String);
  }

  /**
   * 특정 이벤트의 모든 리스너 조회
   *
   * @param eventName 이벤트 이름
   * @returns 리스너 배열
   */
  public getListeners(eventName: string): EventCallback[] {
    return this.listeners.get(eventName) ? Array.from(this.listeners.get(eventName)!) : [];
  }

  /**
   * 모든 리스너 제거
   *
   * @example
   * eventBus.removeAllListeners();
   */
  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
    this.listeners.clear();

    this.logger.info('EventBus: All listeners removed');
  }

  /**
   * 전체 리스너 개수
   *
   * @returns 등록된 모든 리스너 개수
   */
  public getTotalListenerCount(): number {
    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.size;
    }
    return total;
  }

  /**
   * EventBus 상태 조회 (디버깅용)
   *
   * @returns 상태 정보
   */
  public getStatus(): {
    totalListeners: number;
    events: Array<{ name: string; listenerCount: number }>;
  } {
    const events = Array.from(this.listeners.entries()).map(([name, listeners]) => ({
      name,
      listenerCount: listeners.size,
    }));

    return {
      totalListeners: this.getTotalListenerCount(),
      events,
    };
  }

  /**
   * 단일톤 리셋 (테스트용)
   *
   * @internal
   */
  public static reset(): void {
    if (EventBus.instance) {
      EventBus.instance.removeAllListeners();
      EventBus.instance = null;
    }
  }
}

/**
 * 내보내기: 싱글톤 인스턴스를 기본으로 제공
 */
export const eventBus = EventBus.getInstance();
