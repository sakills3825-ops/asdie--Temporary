/**
 * CORS (Cross-Origin Resource Sharing) 설정
 *
 * 보안상 엄격한 CORS 정책 강제:
 * - 명시적 허용 오리진만 수락
 * - URL API로 정규화 및 검증
 * - 와일드카드 절대 금지
 *
 * P0: 오리진 검증 강화 (우회 벡터 방지)
 * - https://example.com.attacker.com ❌
 * - https://example.com%00.attacker.com ❌
 * - IPv4-mapped IPv6 ([::ffff:127.0.0.1]) ❌
 */

/**
 * CORS 설정 (환경별 커스터마이징 지원)
 *
 * P0: 정적 배열로 고정, 와일드카드 금지
 * allowedOrigins: [
 *   'https://trusted-api.example.com', // 정확히 매칭
 *   'http://localhost:3000',            // 로컬 개발용
 * ]
 */
export interface CorsConfig {
  /** 허용된 출처 (와일드카드 없음) */
  allowedOrigins: readonly string[];
  /** 허용된 HTTP 메서드 */
  allowedMethods: readonly string[];
  /** 허용된 헤더 */
  allowedHeaders: readonly string[];
  /** 요청에 쿠키 포함 여부 */
  allowCredentials: boolean;
  /** 프리플라이트 캐시 시간 (초) */
  maxAge: number;
  /** 응답 헤더 노출 */
  exposedHeaders: readonly string[];
}

/**
 * 기본 CORS 설정
 *
 * P1: 환경 변수로 오버라이드 가능하도록 구성
 */
export const CORS_CONFIG: CorsConfig = {
  allowedOrigins: [
    'https://trusted-api.example.com',
    'https://api.aside.dev',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
  ],
  allowCredentials: true,
  maxAge: 86400,
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Number',
    'X-RateLimit-Remaining',
  ],
} as const;

/**
 * 오리진 정규화 및 검증 (P0)
 *
 * URL API를 사용하여 정규화하고, 우회 벡터 방지:
 * - 프래그먼트 제거
 * - 쿼리스트링 제거
 * - 포트 정규화 (기본 포트 생략)
 * - IPv6 주소 형식 검증
 *
 * @param origin 원본 오리진 문자열
 * @returns 정규화된 오리진 또는 null (잘못된 형식)
 *
 * @example
 * normalizeOrigin('https://example.com:443') // 'https://example.com'
 * normalizeOrigin('https://example.com#fragment') // 'https://example.com'
 * normalizeOrigin('https://[::ffff:127.0.0.1]') // 'https://[::1]' 또는 null
 */
export function normalizeOrigin(origin: string): string | null {
  try {
    // URL 파싱으로 자동 정규화
    const url = new URL(origin);

    // 프래그먼트는 클라이언트에서만 사용되므로 제거 (더블 체크)
    if (url.hash) {
      return null; // 오리진에 프래그먼트는 포함되면 안됨
    }

    // 쿼리스트링도 오리진에 포함되면 안됨
    if (url.search) {
      return null;
    }

    // 패스도 오리진에 포함되면 안됨
    if (url.pathname !== '/') {
      return null;
    }

    // IPv6 주소의 IPv4-mapped 형식 감지 및 거부
    // [::ffff:192.0.2.1] → 거부
    if (url.hostname.includes('::ffff:')) {
      return null;
    }

    return url.origin;
  } catch {
    // 잘못된 URL 형식
    return null;
  }
}

/**
 * 주어진 출처가 CORS 허용 목록에 있는지 확인 (P0)
 *
 * 검증 프로세스:
 * 1. 오리진 정규화
 * 2. 정확한 문자열 매칭 (정규식 없음)
 * 3. 대소문자 구분 (호스트명은 불변이므로)
 *
 * @param origin 요청 오리진
 * @returns true if allowed, false otherwise
 *
 * @example
 * isOriginAllowed('https://trusted-api.example.com') // true
 * isOriginAllowed('https://trusted-api.example.com.attacker.com') // false
 * isOriginAllowed('https://example.com.trusted-api.example.com') // false
 */
export function isOriginAllowed(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  return CORS_CONFIG.allowedOrigins.includes(normalized);
}

/**
 * CORS 응답 헤더 생성 (P0)
 *
 * 조건:
 * - 허용된 오리진인 경우만 헤더 반환
 * - allowCredentials가 true면 Access-Control-Allow-Credentials 포함
 * - allowCredentials가 true일 때 origin은 명시적으로 설정 (와일드카드 불가)
 *
 * @param origin 요청 오리진
 * @returns CORS 헤더 맵 또는 빈 객체 (거부)
 *
 * @example
 * getCorsHeaders('https://trusted-api.example.com')
 * // {
 * //   'Access-Control-Allow-Origin': 'https://trusted-api.example.com',
 * //   'Access-Control-Allow-Methods': 'GET, POST, ...',
 * //   ...
 * // }
 */
export function getCorsHeaders(origin: string): Record<string, string> {
  if (!isOriginAllowed(origin)) {
    return {};
  }

  const normalized = normalizeOrigin(origin)!; // 위에서 검증했으므로 safe

  return {
    'Access-Control-Allow-Origin': normalized,
    'Access-Control-Allow-Methods': CORS_CONFIG.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': CORS_CONFIG.allowedHeaders.join(', '),
    'Access-Control-Allow-Credentials': String(CORS_CONFIG.allowCredentials),
    'Access-Control-Max-Age': String(CORS_CONFIG.maxAge),
    'Access-Control-Expose-Headers': CORS_CONFIG.exposedHeaders.join(', '),
  };
}

/**
 * 프리플라이트 요청(OPTIONS) 처리 (P0)
 *
 * 프리플라이트 요청:
 * - 실제 요청 전 브라우저가 자동 송신
 * - OPTIONS 메서드 사용
 * - 실제 요청의 메서드/헤더를 확인
 *
 * @param origin 요청 오리진
 * @returns CORS 헤더 맵 또는 null (거부)
 *
 * @example
 * // 브라우저가 OPTIONS 요청 송신
 * const headers = handleCorsPreFlight('https://trusted-api.example.com');
 * if (headers) {
 *   response.set(headers);
 *   response.status(204).send();
 * } else {
 *   response.status(403).send('CORS denied');
 * }
 */
export function handleCorsPreFlight(origin: string): Record<string, string> | null {
  if (!isOriginAllowed(origin)) {
    return null;
  }

  return getCorsHeaders(origin);
}
