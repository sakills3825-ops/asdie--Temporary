/**
 * Platform 환경 검증 (Environment Validation)
 * 
 * 목적:
 * - 환경 변수 검증 (존재, 절대 경로, 접근 권한)
 * - OS 감지 정확성 개선 (win32/darwin/linux + unknown)
 * - Windows 특이사항 처리 (APPDATA vs LOCALAPPDATA)
 * - Electron 업데이트 경로 안전성
 * 
 * 설계:
 * - 환경 변수: 검증된 값만 사용
 * - OS 감지: 예상 불가 플랫폼도 처리
 * - 경로: 절대 경로 + 존재 확인 + 쓰기 권한
 * - Fallback: 환경 변수 없으면 기본값 사용
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ============================================================================
// 플랫폼 감지 개선
// ============================================================================

/**
 * 지원하는 플랫폼
 */
export type Platform = 'win32' | 'darwin' | 'linux' | 'unknown';

/**
 * 지원하는 CPU 아키텍처
 */
export type Arch = 'x64' | 'arm64' | 'unknown';

/**
 * 현재 플랫폼 감지 (개선)
 * 
 * @returns 'win32' | 'darwin' | 'linux' | 'unknown'
 */
export function getPlatformSafe(): Platform {
  const platform = process.platform;

  // 지원하는 플랫폼
  const supported: Platform[] = ['win32', 'darwin', 'linux'];

  if (supported.includes(platform as Platform)) {
    return platform as Platform;
  }

  // 알려진 플랫폼들 (지원 안 함)
  // - 'aix', 'freebsd', 'openbsd', 'sunos' 등
  console.warn(`Unknown platform: ${platform}`);
  return 'unknown';
}

/**
 * CPU 아키텍처 감지 (개선)
 * 
 * @returns 'x64' | 'arm64' | 'unknown'
 */
export function getArchSafe(): Arch {
  const arch = process.arch;

  const supported: Arch[] = ['x64', 'arm64'];

  if (supported.includes(arch as Arch)) {
    return arch as Arch;
  }

  // 알려진 아키텍처들 (지원 안 함)
  // - 'ia32', 'arm', 'ppc64', 's390' 등
  console.warn(`Unsupported architecture: ${arch}`);
  return 'unknown';
}

// ============================================================================
// 환경 변수 검증
// ============================================================================

/**
 * 환경 변수 읽기 (검증)
 * 
 * @param name - 환경 변수명
 * @param options - 검증 옵션
 * @returns 값 또는 undefined
 * @throws Error - 검증 실패
 */
export interface EnvVarOptions {
  required?: boolean; // 필수인가?
  mustBeAbsolute?: boolean; // 절대 경로여야 하는가?
  mustExist?: boolean; // 존재해야 하는가?
  mustBeWritable?: boolean; // 쓰기 권한 필요?
}

export function getEnvVariable(
  name: string,
  options?: EnvVarOptions
): string | undefined {
  const value = process.env[name];

  // 1. 필수 확인
  if (options?.required && !value) {
    throw new Error(`Required environment variable missing: ${name}`);
  }

  if (!value) {
    return undefined;
  }

  // 2. 절대 경로 확인
  if (options?.mustBeAbsolute && !path.isAbsolute(value)) {
    throw new Error(`Environment variable must be absolute path: ${name}=${value}`);
  }

  // 3. 존재 확인
  if (options?.mustExist && !fs.existsSync(value)) {
    throw new Error(`Path from environment variable does not exist: ${name}=${value}`);
  }

  // 4. 쓰기 권한 확인
  if (options?.mustBeWritable) {
    try {
      fs.accessSync(value, fs.constants.W_OK);
    } catch {
      throw new Error(`Path not writable (check permissions): ${name}=${value}`);
    }
  }

  return value;
}

// ============================================================================
// Windows 특이사항 처리
// ============================================================================

/**
 * Windows: AppData 경로 선택
 * 
 * - APPDATA: %USERPROFILE%\AppData\Roaming (로밍 프로필)
 *   → 네트워크 동기화 가능, 느림
 * - LOCALAPPDATA: %USERPROFILE%\AppData\Local (로컬만)
 *   → 네트워크 미동기, 빠름
 * 
 * 애플리케이션 데이터는 LOCALAPPDATA 권장
 * 
 * @returns Windows AppData 경로
 */
export function getWindowsAppDataPath(): string {
  // 1. LOCALAPPDATA 시도 (권장)
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData && fs.existsSync(localAppData)) {
    return localAppData;
  }

  // 2. APPDATA 시도 (fallback)
  const appData = process.env.APPDATA;
  if (appData && fs.existsSync(appData)) {
    return appData;
  }

  // 3. USERPROFILE 기반 구성
  const userProfile = process.env.USERPROFILE;
  if (userProfile) {
    const fallbackPath = path.join(userProfile, 'AppData', 'Local');
    if (fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }

  // 4. 최후의 수단: 홈 디렉토리
  return path.join(os.homedir(), 'AppData', 'Local');
}

/**
 * macOS: 애플리케이션 지원 디렉토리
 * 
 * ~/Library/Application Support/AppName 권장
 * 
 * @param appName - 애플리케이션 이름
 * @returns macOS 애플리케이션 지원 경로
 */
export function getMacOSAppSupportPath(appName: string): string {
  return path.join(os.homedir(), 'Library', 'Application Support', appName);
}

/**
 * Linux: XDG Base Directory Specification
 * 
 * - XDG_DATA_HOME: ~/.local/share (기본)
 * - XDG_CONFIG_HOME: ~/.config
 * - XDG_CACHE_HOME: ~/.cache
 * 
 * @returns Linux 데이터 디렉토리
 */
export function getLinuxDataPath(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;

  if (xdgDataHome && fs.existsSync(xdgDataHome)) {
    return xdgDataHome;
  }

  return path.join(os.homedir(), '.local', 'share');
}

// ============================================================================
// 크로스플랫폼 경로 (Electron 안전성)
// ============================================================================

/**
 * 애플리케이션 데이터 디렉토리 (크로스플랫폼)
 * 
 * Electron app.getPath('userData')와 유사
 * 
 * - Windows: %LOCALAPPDATA%\AppName
 * - macOS: ~/Library/Application Support/AppName
 * - Linux: ~/.local/share/appname
 * 
 * @param appName - 애플리케이션 이름
 * @returns 애플리케이션 데이터 디렉토리 (절대 경로)
 */
export function getAppDataDir(appName: string): string {
  const platform = getPlatformSafe();

  switch (platform) {
    case 'win32':
      return path.join(getWindowsAppDataPath(), appName);

    case 'darwin':
      return getMacOSAppSupportPath(appName);

    case 'linux':
      return path.join(getLinuxDataPath(), appName.toLowerCase());

    default:
      // unknown 플랫폼: fallback
      return path.join(os.homedir(), `.${appName.toLowerCase()}`);
  }
}

/**
 * 로그 디렉토리 (크로스플랫폼)
 * 
 * - Windows: %LOCALAPPDATA%\AppName\logs
 * - macOS: ~/Library/Logs/AppName
 * - Linux: ~/.local/share/appname/logs
 * 
 * @param appName - 애플리케이션 이름
 * @returns 로그 디렉토리 (절대 경로)
 */
export function getLogsDir(appName: string): string {
  const platform = getPlatformSafe();

  switch (platform) {
    case 'win32':
      return path.join(getAppDataDir(appName), 'logs');

    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Logs', appName);

    case 'linux':
      return path.join(getAppDataDir(appName), 'logs');

    default:
      return path.join(getAppDataDir(appName), 'logs');
  }
}

/**
 * 캐시 디렉토리 (크로스플랫폼)
 * 
 * - Windows: %LOCALAPPDATA%\AppName\Cache
 * - macOS: ~/Library/Caches/AppName
 * - Linux: ~/.cache/appname
 * 
 * @param appName - 애플리케이션 이름
 * @returns 캐시 디렉토리 (절대 경로)
 */
export function getCacheDir(appName: string): string {
  const platform = getPlatformSafe();

  switch (platform) {
    case 'win32':
      return path.join(getAppDataDir(appName), 'Cache');

    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Caches', appName);

    case 'linux':
      const xdgCacheHome = process.env.XDG_CACHE_HOME;
      if (xdgCacheHome && fs.existsSync(xdgCacheHome)) {
        return path.join(xdgCacheHome, appName.toLowerCase());
      }
      return path.join(os.homedir(), '.cache', appName.toLowerCase());

    default:
      return path.join(getAppDataDir(appName), 'cache');
  }
}

// ============================================================================
// 응급 디렉토리 (Fallback)
// ============================================================================

/**
 * 임시 디렉토리 안전 생성
 * 
 * 충돌 방지하는 임시 디렉토리 생성
 * 
 * @param prefix - 디렉토리 이름 접두사
 * @returns 생성된 임시 디렉토리 (절대 경로)
 */
export function createTempDirSafe(prefix: string): string {
  // fs.mkdtempSync은 경쟁 조건 없음 (OS가 제공)
  const tempBase = os.tmpdir();
  const tempDir = fs.mkdtempSync(path.join(tempBase, prefix));
  return tempDir;
}

/**
 * 디렉토리 정리 (안전)
 * 
 * 디렉토리 내용을 재귀적으로 삭제
 * 
 * @param dirPath - 삭제할 디렉토리
 */
export function removeDirSafe(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  // 재귀 삭제 (Node.js 14.14+)
  fs.rmSync(dirPath, { recursive: true, force: true });
}
