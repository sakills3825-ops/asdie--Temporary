/**
 * Security 모듈 export index
 *
 * Main/Renderer에서 다음과 같이 사용:
 * - import { generateCspHeader, CSP_POLICY } from '@shared/security'
 * - import { CORS_CONFIG, isOriginAllowed } from '@shared/security'
 * - import { RateLimiter, RATE_LIMITS } from '@shared/security'
 * - import { hasPermission, Permission } from '@shared/security'
 */

export { CSP_POLICY, generateCspHeader, generateCspMetaTag } from './csp';
export type { CspViolationReport } from './csp';

export { CORS_CONFIG, isOriginAllowed, getCorsHeaders, handleCorsPreFlight } from './cors';

export { RATE_LIMITS, RateLimiter, createRateLimiter } from './rateLimiting';

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
