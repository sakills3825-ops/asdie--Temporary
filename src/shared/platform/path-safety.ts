/**
 * Platform 경로 안전성 (Path Safety)
 * 
 * 목적:
 * - 경로 순회 공격 (Path Traversal) 방지
 * - 심링크 공격 방지
 * - TOCTOU (Time-of-Check-Time-of-Use) 공격 방지
 * - 파일/디렉토리 권한 검증
 * 
 * 설계:
 * - 경로 정규화: ../../../ 탈출 감지
 * - 심링크 검사: fs.realpathSync() 활용
 * - 범위 확인: base 경로 내에만 접근
 * - Atomic 작업: 검사와 생성을 원자적으로
 * - 권한 검증: 파일/디렉토리 소유권, 권한 확인
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// 경로 검증 (Path Validation)
// ============================================================================

/**
 * 경로가 traversal 공격 시도인지 확인
 * 
 * 공격 벡터:
 * - "../../../etc/passwd" (상대 경로로 상위 디렉토리 접근)
 * - "/etc/passwd" (절대 경로로 다른 경로 접근)
 * 
 * @param filePath - 검증할 경로
 * @returns traversal 공격이면 true
 */
export function isPathTraversal(filePath: string): boolean {
  // 절대 경로 거부
  if (path.isAbsolute(filePath)) {
    return true;
  }

  // 정규화
  const normalized = path.normalize(filePath);

  // 상대 경로 탈출 시도 (..)
  if (normalized.startsWith('..') || normalized.includes(path.sep + '..')) {
    return true;
  }

  // null byte 삽입 (C 함수 공격)
  if (filePath.includes('\0')) {
    return true;
  }

  return false;
}

/**
 * 경로 정규화
 * 
 * 경로를 표준 형식으로 변환:
 * - a//b → a/b
 * - a/./b → a/b
 * - a/b/.. → a (상대 범위 내)
 * 
 * @param filePath - 정규화할 경로
 * @returns 정규화된 경로 (절대 경로 아님)
 * @throws Error - traversal 공격 감지 시
 */
export function normalizePath(filePath: string): string {
  // Traversal 공격 감지
  if (isPathTraversal(filePath)) {
    throw new Error(
      `Path traversal detected: ${filePath}`
    );
  }

  // 정규화 (..도 포함 처리)
  const normalized = path.normalize(filePath);

  // 정규화 후에도 traversal 확인
  if (normalized.startsWith('..')) {
    throw new Error(
      `Path escapes base directory: ${normalized}`
    );
  }

  return normalized;
}

/**
 * 경로가 허용된 범위 내인지 확인
 * 
 * 예시:
 * - basePath: /home/user/app
 * - filePath: config/app.json
 * - fullPath: /home/user/app/config/app.json ✅
 * 
 * - fullPath: /home/user/app/../../../etc/passwd ❌
 * 
 * @param basePath - 기본 경로 (절대 경로)
 * @param fullPath - 확인할 경로 (절대 경로)
 * @returns 범위 내면 true
 */
export function isPathInBounds(basePath: string, fullPath: string): boolean {
  // 경로 정규화 (.. 포함 처리)
  const resolvedBase = path.resolve(basePath);
  const resolvedFull = path.resolve(fullPath);

  // fullPath가 basePath 내에 있는가?
  // path.relative()가 .. 포함하면 범위 밖
  const relative = path.relative(resolvedBase, resolvedFull);

  // 범위 밖: 상대 경로가 .. 포함
  if (relative.startsWith('..')) {
    return false;
  }

  // 범위 밖: 절대 경로 (드라이브 문자 변경)
  if (path.isAbsolute(relative)) {
    return false;
  }

  return true;
}

/**
 * 안전한 경로 결합
 * 
 * basePath와 relativePath를 결합하면서 범위 확인
 * 
 * @param basePath - 기본 경로 (절대 경로)
 * @param relativePath - 상대 경로
 * @returns 결합된 경로 (절대 경로)
 * @throws Error - traversal 공격 또는 범위 초과 시
 */
export function joinSafePath(basePath: string, relativePath: string): string {
  // 1. 상대 경로 정규화 (traversal 체크)
  const normalized = normalizePath(relativePath);

  // 2. 경로 결합
  const combined = path.resolve(basePath, normalized);

  // 3. 범위 확인
  if (!isPathInBounds(basePath, combined)) {
    throw new Error(
      `Path outside allowed bounds: ${combined}`
    );
  }

  return combined;
}

// ============================================================================
// 심링크 검사 (Symlink Protection)
// ============================================================================

/**
 * 실제 경로 가져오기 (심링크 팔로우 안 함)
 * 
 * 심링크 공격 방지:
 * - ln -s /etc/passwd /app/config.json
 * - readConfigFile('config.json') ← /etc/passwd 읽음!
 * 
 * @param filePath - 확인할 경로
 * @returns 실제 경로 (절대)
 * @throws Error - 경로 없음
 */
export function getRealPath(filePath: string): string {
  try {
    return fs.realpathSync(filePath);
  } catch (error) {
    throw new Error(`Cannot resolve real path: ${filePath}`);
  }
}

/**
 * 경로가 심링크인지 확인
 * 
 * @param filePath - 확인할 경로
 * @returns 심링크면 true
 */
export function isSymlink(filePath: string): boolean {
  try {
    const stat = fs.lstatSync(filePath); // lstat: symlink 자신의 정보
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * 심링크 공격 방지 - 안전한 파일 읽기
 * 
 * @param filePath - 읽을 파일
 * @param expectedBase - 예상 기본 경로 (선택사항)
 * @returns 파일 내용
 * @throws Error - 심링크 또는 범위 초과
 */
export function safeReadFile(
  filePath: string,
  expectedBase?: string
): string {
  // 1. 실제 경로 얻기 (심링크 추적 X)
  const realPath = getRealPath(filePath);

  // 2. 범위 확인
  if (expectedBase) {
    if (!isPathInBounds(expectedBase, realPath)) {
      throw new Error(
        `File outside expected base: ${realPath}`
      );
    }
  }

  // 3. 파일 읽기
  return fs.readFileSync(realPath, 'utf-8');
}

// ============================================================================
// 파일 권한 검증 (Permission Validation)
// ============================================================================

/**
 * 파일/디렉토리 권한 확인
 * 
 * Unix 권한 비트:
 * 0o755 = rwxr-xr-x (755)
 * 0o700 = rwx------ (700, 소유자만)
 * 0o600 = rw------- (600, 소유자만 읽기/쓰기)
 * 
 * @param filePath - 확인할 경로
 * @returns 권한 (octal) - 예: 0o755
 */
export function getFilePermissions(filePath: string): number {
  const stat = fs.statSync(filePath);
  return stat.mode & 0o7777;
}

/**
 * 파일/디렉토리 소유권 확인
 * 
 * @param filePath - 확인할 경로
 * @returns 소유자 UID
 */
export function getFileOwner(filePath: string): number {
  const stat = fs.statSync(filePath);
  return stat.uid;
}

/**
 * 파일 권한이 너무 너그러운가?
 * 
 * 민감 파일 (config, password 등)은 소유자만 읽을 수 있어야 함:
 * - 허용: 0o600 (rw-------)
 * - 거부: 0o644 (rw-r--r--)
 * - 거부: 0o755 (rwxr-xr-x)
 * 
 * @param filePath - 확인할 경로
 * @returns 너그러우면 true
 */
export function isPermissionTooPermissive(filePath: string): boolean {
  const permissions = getFilePermissions(filePath);
  // group 또는 others가 읽을 수 있으면 너무 너그러움
  return (permissions & 0o077) !== 0;
}

/**
 * 구성 파일 권한 검증 (strict)
 * 
 * 구성 파일 보안 요구사항:
 * - 소유자: 현재 사용자
 * - 권한: 0o600 (rw-------)
 * 
 * @param filePath - 구성 파일 경로
 * @throws Error - 소유권/권한 문제
 */
export function validateConfigFilePermissions(filePath: string): void {
  // Windows에서는 권한 검사 불가 (생략)
  if (process.platform === 'win32') {
    return;
  }

  const stat = fs.statSync(filePath);
  const currentUid = process.getuid?.();

  // 소유권 확인
  if (currentUid !== undefined && stat.uid !== currentUid) {
    throw new Error(
      `Config file not owned by current user: ${filePath}`
    );
  }

  // 권한 확인 (0o600 = rw-------)
  if ((stat.mode & 0o077) !== 0) {
    throw new Error(
      `Config file has overly permissive permissions: ${stat.mode.toString(8)}`
    );
  }
}

// ============================================================================
// TOCTOU (Time-of-Check-Time-of-Use) 방지
// ============================================================================

/**
 * 안전한 디렉토리 생성
 * 
 * TOCTOU 공격 방지:
 * T0: exists? (검사)
 * T1: [공격자] symlink 생성
 * T2: mkdir (symlink 따라가기!)
 * 
 * 해결: atomic 작업 + symlink 확인
 * 
 * @param dirPath - 생성할 디렉토리 (절대 경로)
 * @param expectedBase - 예상 기본 경로 (범위 확인용)
 * @throws Error - symlink 또는 범위 초과
 */
export function safeEnsureDirectory(
  dirPath: string,
  expectedBase?: string
): void {
  try {
    // 1. 생성 시도 (atomic: mkdir은 원자적)
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // 2. EEXIST 아니면 에러
    if (error.code !== 'EEXIST') {
      throw error;
    }

    // 3. 존재 확인
    const stat = fs.lstatSync(dirPath); // lstat: symlink 자신

    // 4. 디렉토리인가?
    if (!stat.isDirectory()) {
      throw new Error(
        `${dirPath} is not a directory`
      );
    }

    // 5. Symlink인가?
    if (stat.isSymbolicLink()) {
      throw new Error(
        `${dirPath} is a symbolic link`
      );
    }

    // 6. 범위 확인
    if (expectedBase) {
      const realPath = fs.realpathSync(dirPath);
      if (!isPathInBounds(expectedBase, realPath)) {
        throw new Error(
          `Directory outside expected base: ${realPath}`
        );
      }
    }
  }
}

/**
 * 안전한 파일 쓰기 (원자적)
 * 
 * @param filePath - 쓸 파일
 * @param content - 파일 내용
 * @param expectedBase - 예상 기본 경로 (선택사항)
 */
export function safeWriteFile(
  filePath: string,
  content: string,
  expectedBase?: string
): void {
  // 범위 확인
  if (expectedBase) {
    const resolved = path.resolve(filePath);
    if (!isPathInBounds(expectedBase, resolved)) {
      throw new Error(
        `File outside allowed bounds: ${resolved}`
      );
    }
  }

  // 임시 파일에 쓰기 (원자적 쓰기)
  const tempPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tempPath, content, { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    // 실패 시 임시 파일 정리
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // 무시
    }
    throw error;
  }
}

// ============================================================================
// 고급: 경로 제한 (Directory Jail)
// ============================================================================

/**
 * 디렉토리 제한 컨텍스트
 * 
 * 특정 디렉토리 내에서만 작업 허용 (jail)
 */
export class SafePath {
  private baseDir: string;

  constructor(baseDir: string) {
    // 기본 디렉토리는 절대 경로여야 함
    if (!path.isAbsolute(baseDir)) {
      throw new Error('Base directory must be absolute');
    }

    this.baseDir = fs.realpathSync(baseDir);
  }

  /**
   * 상대 경로를 안전하게 절대 경로로 변환
   */
  resolve(relativePath: string): string {
    return joinSafePath(this.baseDir, relativePath);
  }

  /**
   * 파일 읽기 (범위 체크)
   */
  read(relativePath: string): string {
    const fullPath = this.resolve(relativePath);
    return safeReadFile(fullPath, this.baseDir);
  }

  /**
   * 파일 쓰기 (범위 체크)
   */
  write(relativePath: string, content: string): void {
    const fullPath = this.resolve(relativePath);
    safeWriteFile(fullPath, content, this.baseDir);
  }

  /**
   * 디렉토리 생성 (범위 체크)
   */
  ensureDir(relativePath: string): void {
    const fullPath = this.resolve(relativePath);
    safeEnsureDirectory(fullPath, this.baseDir);
  }

  /**
   * 기본 디렉토리 반환
   */
  getBase(): string {
    return this.baseDir;
  }
}
