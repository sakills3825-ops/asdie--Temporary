/**
 * Authorization (권한 검증)
 *
 * 사용자 권한 관리 및 접근 제어
 */

/**
 * 시스템 권한 정의
 *
 * 각 기능에 대한 권한을 정의.
 * 사용자는 복수의 권한을 가질 수 있음.
 */
export enum Permission {
  // 읽기 권한
  READ_HISTORY = 'read:history',
  READ_BOOKMARK = 'read:bookmark',
  READ_SETTINGS = 'read:settings',
  READ_DOWNLOADS = 'read:downloads',

  // 쓰기 권한
  WRITE_BOOKMARK = 'write:bookmark',
  WRITE_SETTINGS = 'write:settings',
  WRITE_HISTORY = 'write:history',

  // 삭제 권한
  DELETE_HISTORY = 'delete:history',
  DELETE_BOOKMARK = 'delete:bookmark',
  DELETE_DATA = 'delete:data',

  // 관리 권한
  MANAGE_SETTINGS = 'manage:settings',
  MANAGE_EXTENSIONS = 'manage:extensions',
  MANAGE_USERS = 'manage:users',

  // 시스템 권한
  ADMIN = 'admin',
}

/**
 * 역할 정의
 *
 * 각 역할은 사전 정의된 권한 집합을 가짐.
 */
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  GUEST = 'guest',
}

/**
 * 역할별 기본 권한 매핑
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.READ_HISTORY,
    Permission.READ_BOOKMARK,
    Permission.READ_SETTINGS,
    Permission.WRITE_BOOKMARK,
    Permission.WRITE_SETTINGS,
    Permission.WRITE_HISTORY,
    Permission.DELETE_HISTORY,
    Permission.DELETE_BOOKMARK,
  ],

  [Role.ADMIN]: [
    // 모든 권한
    ...Object.values(Permission),
  ],

  [Role.GUEST]: [
    // 읽기만 가능
    Permission.READ_HISTORY,
    Permission.READ_BOOKMARK,
    Permission.READ_SETTINGS,
  ],
};

/**
 * 사용자 주체(Principal)
 *
 * 인증된 사용자 정보와 그들의 권한.
 */
export interface Principal {
  /** 사용자 ID */
  userId: string;

  /** 사용자 이름 */
  username: string;

  /** 역할 */
  role: Role;

  /** 추가 권한 (역할 기본 권한 외) */
  extraPermissions?: Set<Permission>;

  /** 권한 제외 (역할 기본 권한 중 제외) */
  deniedPermissions?: Set<Permission>;

  /** 인증 토큰 발급 시간 */
  issuedAt: number;

  /** 인증 토큰 만료 시간 */
  expiresAt: number;

  /** 마지막 활동 시간 */
  lastActivity: number;
}

/**
 * 권한 검사
 *
 * Principal이 특정 권한을 가지고 있는지 확인.
 *
 * @example
 * if (hasPermission(principal, Permission.DELETE_HISTORY)) {
 *   // 히스토리 삭제 가능
 * } else {
 *   throw new UnauthorizedError('No permission to delete history');
 * }
 */
export function hasPermission(principal: Principal, permission: Permission): boolean {
  // Admin은 모든 권한 보유
  if (principal.role === Role.ADMIN) {
    return true;
  }

  // 명시적으로 제외된 권한 확인
  if (principal.deniedPermissions?.has(permission)) {
    return false;
  }

  // 역할 기본 권한 확인
  const rolePermissions = ROLE_PERMISSIONS[principal.role];
  if (rolePermissions.includes(permission)) {
    return true;
  }

  // 추가 권한 확인
  if (principal.extraPermissions?.has(permission)) {
    return true;
  }

  return false;
}

/**
 * 복수 권한 검사 (AND 조건)
 *
 * 모든 권한을 가져야 true 반환.
 *
 * @example
 * if (hasPermissions(principal, [Permission.READ_HISTORY, Permission.DELETE_HISTORY])) {
 *   // 둘 다 가능
 * }
 */
export function hasPermissions(principal: Principal, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(principal, permission));
}

/**
 * 복수 권한 검사 (OR 조건)
 *
 * 하나 이상의 권한을 가지면 true 반환.
 *
 * @example
 * if (hasAnyPermission(principal, [Permission.READ_HISTORY, Permission.WRITE_HISTORY])) {
 *   // 하나라도 가능
 * }
 */
export function hasAnyPermission(principal: Principal, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(principal, permission));
}

/**
 * 토큰 만료 확인
 *
 * @example
 * if (isTokenExpired(principal)) {
 *   // 재인증 필요
 * }
 */
export function isTokenExpired(principal: Principal): boolean {
  return Date.now() > principal.expiresAt;
}

/**
 * 사용자 활동 시간 업데이트
 */
export function updateLastActivity(principal: Principal): void {
  principal.lastActivity = Date.now();
}

/**
 * Principal 생성 헬퍼 (테스트/기본값용)
 *
 * @example
 * const admin = createPrincipal('admin-1', 'admin', Role.ADMIN);
 */
export function createPrincipal(
  userId: string,
  username: string,
  role: Role,
  tokenTtlMs: number = 24 * 60 * 60 * 1000 // 기본 24시간
): Principal {
  const now = Date.now();

  return {
    userId,
    username,
    role,
    issuedAt: now,
    expiresAt: now + tokenTtlMs,
    lastActivity: now,
  };
}
