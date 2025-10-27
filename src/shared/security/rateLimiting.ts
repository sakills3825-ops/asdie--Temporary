/**
 * Rate Limiting (속도 제한)
 *
 * IPC, API 호출 등 리소스 소비를 제어하여 DoS 공격 방어.
 */

/**
 * Rate Limit 설정
 *
 * 각 채널별 시간당 최대 요청 수 정의
 */
export const RATE_LIMITS = {
  // IPC 채널 일반 제한
  IPC_CALLS: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1분
    message: 'Too many IPC calls - rate limited',
  },

  // 브라우저 네비게이션 제한 (1초에 10회)
  BROWSER_NAVIGATE: {
    maxRequests: 10,
    windowMs: 1000,
    message: 'Navigation rate limited',
  },

  // 파일 작업 제한
  FILE_OPERATIONS: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1분
    message: 'File operation rate limited',
  },

  // 외부 API 호출 제한
  API_CALLS: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1분
    message: 'API rate limit exceeded',
  },

  // 인증 시도 제한 (5회/15분)
  AUTH_ATTEMPTS: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15분
    message: 'Too many authentication attempts',
  },

  // 데이터베이스 쿼리 제한
  DB_QUERIES: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1분
    message: 'Database query rate limited',
  },
} as const;

/**
 * Rate Limiter 구현용 클래스
 *
 * 슬라이딩 윈도우(Sliding Window) 방식으로 요청 수를 추적.
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * 요청 허용 여부 확인
   *
   * @param key - 클라이언트 식별자 (IP, 사용자ID, IPC 채널 등)
   * @returns 요청 허용 시 true, 제한 시 false
   *
   * @example
   * const limiter = new RateLimiter(10, 1000);
   * if (limiter.isAllowed('user-123')) {
   *   // 요청 처리
   * } else {
   *   // 속도 제한됨
   * }
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 해당 키의 요청 타임스탐프 배열
    let timestamps = this.requests.get(key) || [];

    // 윈도우 범위 밖의 오래된 요청 제거
    timestamps = timestamps.filter((timestamp) => timestamp > windowStart);

    // 요청 허용 판단
    const isAllowed = timestamps.length < this.maxRequests;

    if (isAllowed) {
      timestamps.push(now);
      this.requests.set(key, timestamps);
    }

    return isAllowed;
  }

  /**
   * 남은 요청 횟수 조회
   *
   * @example
   * const remaining = limiter.getRemaining('user-123');
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = (this.requests.get(key) || []).filter(
      (timestamp) => timestamp > windowStart
    );

    return Math.max(0, this.maxRequests - timestamps.length);
  }

  /**
   * 다음 요청 가능 시간 (밀리초)
   *
   * @example
   * const retryAfter = limiter.getRetryAfter('user-123');
   * if (retryAfter > 0) {
   *   console.log(`Retry after ${retryAfter}ms`);
   * }
   */
  getRetryAfter(key: string): number {
    const timestamps = this.requests.get(key) || [];
    if (timestamps.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...timestamps);
    const retryTime = oldestRequest + this.windowMs;
    const now = Date.now();

    return Math.max(0, retryTime - now);
  }

  /**
   * 특정 키의 요청 이력 초기화
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * 모든 요청 이력 초기화
   */
  resetAll(): void {
    this.requests.clear();
  }
}

/**
 * 채널별 Rate Limiter 인스턴스 생성
 *
 * @example
 * const ipcLimiter = createRateLimiter('IPC_CALLS');
 * if (!ipcLimiter.isAllowed('renderer:tab-1')) {
 *   throw new Error('Rate limited');
 * }
 */
export function createRateLimiter(limitKey: keyof typeof RATE_LIMITS): RateLimiter {
  const config = RATE_LIMITS[limitKey];
  return new RateLimiter(config.maxRequests, config.windowMs);
}
