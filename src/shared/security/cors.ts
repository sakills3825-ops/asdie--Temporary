/**
 * CORS (Cross-Origin Resource Sharing) 설정
 *
 * Electron 환경에서는 CORS가 기본적으로 동작하지 않지만,
 * 외부 API 통신이나 웹 뷰 임베드 시 필요.
 */

/**
 * CORS 설정
 *
 * @example
 * if (isCorsAllowed(request.headers.origin)) {
 *   response.headers['Access-Control-Allow-Origin'] = request.headers.origin;
 * }
 */
export const CORS_CONFIG = {
  // 허용된 출처 (프로토콜 + 도메인)
  allowedOrigins: [
    'https://trusted-api.example.com',
    'https://api.zenb.dev',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],

  // 허용된 HTTP 메서드
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  // 허용된 헤더
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],

  // 요청에 쿠키 포함 허용
  allowCredentials: true,

  // 프리플라이트 요청 캐시 시간 (초)
  maxAge: 86400,

  // 응답 헤더 노출
  exposedHeaders: ['X-Total-Count', 'X-Page-Number', 'X-RateLimit-Remaining'],
} as const;

/**
 * 주어진 출처가 CORS 허용 목록에 있는지 확인
 *
 * @example
 * if (isOriginAllowed('https://trusted-api.example.com')) {
 *   // CORS 헤더 추가
 * }
 */
export function isOriginAllowed(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (CORS_CONFIG.allowedOrigins as readonly string[]).includes(url.origin);
  } catch {
    return false;
  }
}

/**
 * CORS 응답 헤더 생성
 *
 * @example
 * const headers = getCorsHeaders('https://trusted-api.example.com');
 * response.set(headers);
 */
export function getCorsHeaders(origin: string): Record<string, string> {
  if (!isOriginAllowed(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': CORS_CONFIG.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': CORS_CONFIG.allowedHeaders.join(', '),
    'Access-Control-Allow-Credentials': String(CORS_CONFIG.allowCredentials),
    'Access-Control-Max-Age': String(CORS_CONFIG.maxAge),
    'Access-Control-Expose-Headers': CORS_CONFIG.exposedHeaders.join(', '),
  };
}

/**
 * 프리플라이트 요청(OPTIONS) 처리
 *
 * @example
 * if (request.method === 'OPTIONS') {
 *   const headers = getCorsHeaders(request.headers.origin);
 *   response.set(headers);
 *   response.status(200).send();
 * }
 */
export function handleCorsPreFlight(origin: string): Record<string, string> | null {
  if (!isOriginAllowed(origin)) {
    return null;
  }

  return getCorsHeaders(origin);
}
