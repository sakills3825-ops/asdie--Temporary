/**
 * Content Security Policy (CSP) 정의
 *
 * Electron 렌더러 프로세스에서 사용할 CSP 정책.
 * XSS, 클릭재킹, 프레임 인젝션 등 공격 방어.
 */

/**
 * CSP 정책 정의
 *
 * 주요 지시문:
 * - default-src: 기본 리소스 정책
 * - script-src: 스크립트 실행 정책
 * - style-src: 스타일시트 정책
 * - img-src: 이미지 정책
 * - connect-src: XHR, WebSocket 정책
 * - frame-ancestors: 프레임 삽입 금지
 * - base-uri: <base> 태그 제한
 * - form-action: <form> 제출 대상 제한
 */
export const CSP_POLICY = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"], // Wasm 지원
  'style-src': ["'self'", "'unsafe-inline'"], // Tailwind CSS
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': ["'self'", 'https:'], // HTTPS만
  'font-src': ["'self'"],
  'object-src': ["'none'"], // Flash 비활성화
  'media-src': ["'self'"],
  'child-src': ["'none'"],
  'frame-ancestors': ["'none'"], // 프레임 삽입 금지
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [], // HTTP → HTTPS
} as const;

/**
 * CSP 헤더 문자열 생성
 *
 * @example
 * "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; ..."
 */
export function generateCspHeader(): string {
  return Object.entries(CSP_POLICY)
    .map(([key, values]) => {
      if (values.length === 0) {
        // upgrade-insecure-requests 같은 빈 배열
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Meta 태그용 CSP 생성 (Renderer HTML에서 사용)
 *
 * @example
 * <meta http-equiv="Content-Security-Policy" content="..." />
 */
export function generateCspMetaTag(): string {
  return `<meta http-equiv="Content-Security-Policy" content="${generateCspHeader()}" />`;
}

/**
 * CSP 위반 보고서 타입
 *
 * CSP 위반 이벤트의 세부 정보
 */
export interface CspViolationReport {
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  blockedUri?: string;
  disposition: 'enforce' | 'report';
  statusCode: number;
  timestamp: string;
}
