/**
 * Security 모듈 export index
 *
 * P0 구현:
 * - CORS: Origin 검증 강화 (normalizeOrigin, 우회 벡터 방지)
 * - CSP: 강한 정책 (unsafe-inline/eval 제거)
 * - Authorization: Principal 기반 권한 검증
 * - Rate Limiting: 슬라이딩 윈도우 방식
 * - Error Filtering: 민감 정보 제거
 *
 * Main/Renderer에서 사용:
 * - import { normalizeOrigin, isOriginAllowed, getCorsHeaders } from '@shared/security'
 * - import { generateCspHeader, generateCspMetaTag } from '@shared/security'
 * - import { hasPermission, Principal, Role } from '@shared/security'
 * - import { RateLimiter, createRateLimiter } from '@shared/security'
 */

// ===== CORS (P0: Origin Validation) =====
export {
  CORS_CONFIG,
  normalizeOrigin,
  isOriginAllowed,
  getCorsHeaders,
  handleCorsPreFlight,
} from './cors';
export type { CorsConfig } from './cors';

// ===== CSP (P0: Content Security Policy) =====
export {
  CSP_POLICY,
  generateCspHeader,
  generateCspMetaTag,
  isValidCspViolationReport,
} from './csp';
export type { CspPolicy, CspViolationReport } from './csp';

// ===== Rate Limiting (P0: DoS Prevention) =====
export { RATE_LIMITS, RateLimiter, createRateLimiter } from './rateLimiting';

// ===== Authorization (P0: Permission-based Access Control) =====
export {
  Permission,
  Role,
  ROLE_PERMISSIONS,
  hasPermission,
  hasPermissions,
  hasAnyPermission,
  isTokenExpired,
  updateLastActivity,
  createPrincipal,
} from './authorization';
export type { Principal } from './authorization';
