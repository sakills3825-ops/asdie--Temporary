/**
 * Content Security Policy (CSP) 정의
 *
 * P0: 강한 CSP 정책으로 XSS, 클릭재킹, 프레임 인젝션 등 방어
 *
 * 보안 원칙:
 * - 'unsafe-inline' 제거 (인라인 스크립트 금지) ✅
 * - 'unsafe-eval' 제거 (동적 코드 실행 금지) ✅
 * - Tailwind CSS는 PostCSS로 사전 컴파일하여 스타일 'self'만 사용
 * - Wasm은 'wasm-unsafe-eval' 제한적 허용
 * - 외부 스크립트는 정확한 Nonce 또는 SRI 해시 필요
 * - report-uri로 위반 감지 (P1)
 */

/**
 * CSP 정책 정의 (P0)
 *
 * 주요 지시문:
 * - default-src: 기본 리소스 정책 ('self'만)
 * - script-src: 스크립트 실행 정책 (인라인 금지)
 * - style-src: 스타일시트 정책 (외부만)
 * - img-src: 이미지 정책 (데이터 URL, HTTPS)
 * - connect-src: XHR, WebSocket (HTTPS만)
 * - frame-ancestors: 프레임 삽입 금지
 * - base-uri: <base> 태그 제한
 * - form-action: <form> 제출 대상 제한
 * - object-src: Flash, Java 비활성화
 * - upgrade-insecure-requests: HTTP → HTTPS 업그레이드
 * - report-uri/report-to: CSP 위반 보고 (P1)
 */
export interface CspPolicy {
  [directive: string]: string[];
}

export const CSP_POLICY: CspPolicy = {
  // 기본 정책: 자신의 출처(프로토콜+도메인)에서만 로드
  'default-src': ["'self'"],

  // 스크립트: 'self'와 Wasm만, 인라인/eval 금지
  'script-src': ["'self'", "'wasm-unsafe-eval'"],

  // 스타일: 외부 스타일시트만 (PostCSS로 사전 컴파일)
  // ⚠️ 'unsafe-inline' 제거됨 (P0)
  'style-src': ["'self'"],

  // 이미지: 자신의 출처, 데이터 URL, HTTPS
  'img-src': ["'self'", 'data:', 'https:'],

  // 연결: HTTPS만 (localhost 개발용은 http:// 추가 가능)
  'connect-src': ["'self'", 'https:', 'http://localhost:*'],

  // 폰트: 자신의 출처 + Google Fonts
  // Google Fonts 폰트 파일: fonts.gstatic.com
  // Google Fonts API: fonts.googleapis.com
  'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'],

  // 오브젝트(Flash, Java): 비활성화
  'object-src': ["'none'"],

  // 미디어(음성/영상): 자신의 출처만
  'media-src': ["'self'"],

  // 자식 프레임(iframe): 금지
  'child-src': ["'none'"],

  // 프레임 앵커(이 페이지를 iframe으로 임베드): 금지
  'frame-ancestors': ["'none'"],

  // <base href=""> 태그: 자신의 출처만
  'base-uri': ["'self'"],

  // <form action=""> 제출: 자신의 출처만
  'form-action': ["'self'"],

  // 업그레이드 명령: HTTP → HTTPS (평문 로드 거부)
  'upgrade-insecure-requests': [],

  // P1: 위반 보고 엔드포인트 (리포트 수집용)
  // 'report-uri': ['/api/security/csp-report'],
  // 'report-to': ['csp-endpoint'],
} as const;

/**
 * CSP 헤더 문자열 생성 (P0)
 *
 * CSP 정책을 HTTP 헤더 형식의 문자열로 변환
 *
 * @returns CSP 헤더 문자열
 * @example
 * "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; ..."
 */
export function generateCspHeader(): string {
  return Object.entries(CSP_POLICY)
    .map(([key, values]) => {
      if (values.length === 0) {
        // upgrade-insecure-requests, report-uri 같은 빈 배열
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Meta 태그용 CSP 생성 (P0)
 *
 * Renderer HTML에서 사용할 Meta 태그 생성
 * (주의: report-uri는 Meta 태그에서 작동 안 함)
 *
 * @returns HTML Meta 태그 문자열
 * @example
 * <meta http-equiv="Content-Security-Policy" content="default-src 'self'; ..." />
 */
export function generateCspMetaTag(): string {
  const header = generateCspHeader();
  return `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(
    header
  )}" />`;
}

/**
 * HTML 속성 값 이스케이핑 (CSP 헤더의 특수문자 처리)
 *
 * @param value 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * CSP 위반 보고서 타입 (P1)
 *
 * CSP 위반 이벤트의 세부 정보
 * report-uri 엔드포인트에서 수신하는 데이터
 */
export interface CspViolationReport {
  'csp-report': {
    'document-uri': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'blocked-uri'?: string;
    'disposition': 'enforce' | 'report';
    'status-code'?: number;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
  };
}

/**
 * CSP 위반 검증 (P1)
 *
 * CSP 위반 보고서의 형식 검증
 *
 * @param report CSP 위반 보고서
 * @returns 유효한 보고서면 true
 */
export function isValidCspViolationReport(report: unknown): report is CspViolationReport {
  if (!report || typeof report !== 'object') {
    return false;
  }

  const obj = report as Record<string, unknown>;
  if (!('csp-report' in obj) || typeof obj['csp-report'] !== 'object') {
    return false;
  }

  const cspReport = obj['csp-report'] as Record<string, unknown>;
  return (
    typeof cspReport['document-uri'] === 'string' &&
    typeof cspReport['violated-directive'] === 'string' &&
    typeof cspReport['disposition'] === 'string'
  );
}
