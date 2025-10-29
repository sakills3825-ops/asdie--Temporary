/**
 * CacheManager - 캐시 관리 유틸
 *
 * 책임: 인메모리 캐싱
 * - TTL 기반 캐시
 * - 자동 만료
 * - 캐시 통계
 *
 * SRP 원칙: 캐싱 로직만 담당
 */

import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';

/**
 * 캐시 항목
 */
interface CacheItem<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

/**
 * 캐시 통계
 */
interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalMemoryUsage: number; // 대략적인 추정치
}

/**
 * 캐시 매니저 (제네릭)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CacheManager<T = any> {
  private logger: ILogger;
  private cache: Map<string, CacheItem<T>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5분
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1분마다 정리

  constructor(
    cacheName: string = 'DefaultCache',
    private defaultTTL: number = this.DEFAULT_TTL
  ) {
    this.logger = new LoggerImpl(`CacheManager[${cacheName}]`, LogLevel.INFO);
    this.startCleanupRoutine();
  }

  /**
   * 캐시에 값 저장
   */
  public set(key: string, value: T, ttl: number = this.defaultTTL): void {
    if (!key) {
      this.logger.warn('CacheManager: Empty key provided');
      return;
    }

    const expiresAt = Date.now() + ttl;
    const cacheItem: CacheItem<T> = {
      value,
      expiresAt,
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now(),
    };

    this.cache.set(key, cacheItem);

    this.logger.info('CacheManager: Value cached', {
      module: 'CacheManager',
      metadata: { key, ttl },
    });
  }

  /**
   * 캐시에서 값 조회
   */
  public get(key: string): T | null {
    if (!key) {
      this.stats.misses++;
      return null;
    }

    const item = this.cache.get(key);

    // 캐시 미스
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // 만료 확인
    if (item.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // 캐시 히트
    item.accessCount++;
    item.lastAccessedAt = Date.now();
    this.stats.hits++;

    return item.value;
  }

  /**
   * 캐시에 값이 있는지 확인
   */
  public has(key: string): boolean {
    if (!key) return false;

    const item = this.cache.get(key);
    if (!item) return false;

    // 만료 확인
    if (item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 캐시에서 삭제
   */
  public delete(key: string): boolean {
    if (!key) return false;

    const deleted = this.cache.delete(key);

    if (deleted) {
      this.logger.info('CacheManager: Value deleted', {
        module: 'CacheManager',
        metadata: { key },
      });
    }

    return deleted;
  }

  /**
   * 캐시 전체 삭제
   */
  public clear(): void {
    const size = this.cache.size;
    this.cache.clear();

    this.logger.info('CacheManager: Cache cleared', {
      module: 'CacheManager',
      metadata: { clearedCount: size },
    });
  }

  /**
   * 만료된 항목 정리
   */
  public cleanup(): number {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      this.logger.info('CacheManager: Expired items cleaned', {
        module: 'CacheManager',
        metadata: { cleanedCount: keysToDelete.length },
      });
    }

    return keysToDelete.length;
  }

  /**
   * 캐시 통계 조회
   */
  public getStats(): CacheStats {
    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;
    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    // 메모리 사용량 추정 (매우 대략적)
    let totalMemory = 0;
    for (const item of this.cache.values()) {
      totalMemory += JSON.stringify(item.value).length * 2; // 문자당 약 2바이트 추정
    }

    return {
      size: this.cache.size,
      hits: totalHits,
      misses: totalMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalMemoryUsage: totalMemory,
    };
  }

  /**
   * 자동 정리 루틴 시작
   */
  private startCleanupRoutine(): void {
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        this.logger.debug(`CacheManager: Auto cleanup removed ${cleaned} expired items`);
      }
    }, this.CLEANUP_INTERVAL);

    // 프로세스 종료 시 정리
    if (this.cleanupInterval) {
      this.cleanupInterval.unref();
    }

    this.logger.info('CacheManager: Cleanup routine started', {
      module: 'CacheManager',
      metadata: { interval: this.CLEANUP_INTERVAL },
    });
  }

  /**
   * 자동 정리 루틴 중지
   */
  public stopCleanupRoutine(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('CacheManager: Cleanup routine stopped');
    }
  }

  /**
   * 캐시 크기 조회
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * 캐시 초기화 (통계 포함)
   */
  public reset(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    this.logger.info('CacheManager: Cache reset');
  }

  /**
   * 소멸자
   */
  public destroy(): void {
    this.stopCleanupRoutine();
    this.cache.clear();
    this.logger.info('CacheManager: Cache destroyed');
  }
}
