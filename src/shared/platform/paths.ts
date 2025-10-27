/**
 * Platform-specific 경로 처리
 *
 * Windows/Mac/Linux에서 경로를 크로스 플랫폼으로 다루기.
 *
 * 주의점:
 * - Windows: C:\Users\... (드라이브 문자, 백슬래시)
 * - Unix: /home/... (슬래시)
 * - macOS: /Users/... (슬래시)
 */

import path from 'path';
import os from 'os';

/**
 * 플랫폼 정보
 */
export type Platform = 'win32' | 'darwin' | 'linux';

/**
 * 현재 플랫폼 가져오기
 *
 * @returns 'win32' | 'darwin' | 'linux'
 */
export function getPlatform(): Platform {
  return process.platform as Platform;
}

/**
 * 플랫폼별 홈 디렉토리 경로
 *
 * @example
 * getHomeDir()  // /Users/username (Mac) 또는 /home/username (Linux) 또는 C:\Users\username (Windows)
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * 플랫폼별 임시 디렉토리 경로
 *
 * @example
 * getTempDir()  // /var/folders/... (Mac) 또는 /tmp (Linux) 또는 C:\Users\...\AppData\Local\Temp (Windows)
 */
export function getTempDir(): string {
  return os.tmpdir();
}

/**
 * Zen 브라우저 데이터 디렉토리
 *
 * 로그, 캐시, 사용자 데이터 등을 저장할 디렉토리.
 *
 * @example
 * Windows: C:\Users\username\AppData\Local\Zen
 * Mac:     /Users/username/Library/Application Support/Zen
 * Linux:   /home/username/.local/share/zen
 */
export function getZenDataDir(): string {
  const home = getHomeDir();
  const platform = getPlatform();

  switch (platform) {
    case 'win32':
      // Windows: %LOCALAPPDATA%\Zen
      return path.join(home, 'AppData', 'Local', 'Zen');

    case 'darwin':
      // macOS: ~/Library/Application Support/Zen
      return path.join(home, 'Library', 'Application Support', 'Zen');

    case 'linux':
    default:
      // Linux: ~/.local/share/zen
      return path.join(home, '.local', 'share', 'zen');
  }
}

/**
 * Zen 로그 디렉토리
 *
 * @example
 * Windows: C:\Users\username\AppData\Local\Zen\logs
 * Mac:     /Users/username/Library/Logs/Zen
 * Linux:   /home/username/.local/share/zen/logs
 */
export function getZenLogsDir(): string {
  const platform = getPlatform();

  switch (platform) {
    case 'win32':
      return path.join(getZenDataDir(), 'logs');

    case 'darwin':
      // macOS는 별도의 Logs 디렉토리 선호
      return path.join(getHomeDir(), 'Library', 'Logs', 'Zen');

    case 'linux':
    default:
      return path.join(getZenDataDir(), 'logs');
  }
}

/**
 * Zen 캐시 디렉토리
 *
 * @example
 * Windows: C:\Users\username\AppData\Local\Zen\cache
 * Mac:     /Users/username/Library/Caches/Zen
 * Linux:   /home/username/.cache/zen
 */
export function getZenCacheDir(): string {
  const home = getHomeDir();
  const platform = getPlatform();

  switch (platform) {
    case 'win32':
      return path.join(getZenDataDir(), 'cache');

    case 'darwin':
      return path.join(home, 'Library', 'Caches', 'Zen');

    case 'linux':
    default:
      return path.join(home, '.cache', 'zen');
  }
}

/**
 * 경로 정규화 (크로스 플랫폼)
 *
 * - Windows에서: C:\Users\... → C:/Users/... (정규화)
 * - Unix: 그대로
 * - 상대 경로 정규화
 *
 * @example
 * normalizePath('C:\\Users\\file.txt')  // 'C:/Users/file.txt'
 * normalizePath('/home/user/file.txt')  // '/home/user/file.txt'
 */
export function normalizePath(filePath: string): string {
  // path.normalize는 각 OS의 경로 분리자를 사용하므로, 통일하려면 추가 처리
  const normalized = path.normalize(filePath);

  // Windows의 백슬래시를 슬래시로 변환 (일관성)
  return normalized.replace(/\\/g, '/');
}

/**
 * 절대 경로 여부 확인 (크로스 플랫폼)
 *
 * @example
 * isAbsolutePath('C:\\Users\\file.txt')  // true (Windows)
 * isAbsolutePath('/home/user/file.txt')  // true (Unix)
 * isAbsolutePath('./relative.txt')       // false
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * 상대 경로 계산
 *
 * @example
 * getRelativePath('/home/user/a', '/home/user/b/c')  // '../b/c'
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * 경로 분해 (파일명, 확장자 등)
 *
 * @example
 * parsePath('/home/user/file.txt')
 * // { dir: '/home/user', name: 'file', ext: '.txt' }
 */
export function parsePath(filePath: string): path.ParsedPath {
  return path.parse(filePath);
}

/**
 * 경로 합치기 (크로스 플랫폼)
 *
 * @example
 * joinPaths('/home/user', 'documents', 'file.txt')  // '/home/user/documents/file.txt'
 */
export function joinPaths(...paths: string[]): string {
  return path.join(...paths);
}

/**
 * 라인 엔딩 정규화
 *
 * - Windows: CRLF (\r\n) → LF (\n)로 통일
 * - Unix: 이미 LF
 *
 * @example
 * normalizeLineEndings('line1\r\nline2\r\n')  // 'line1\nline2\n'
 */
export function normalizeLineEndings(text: string): string {
  // CRLF → LF
  return text.replace(/\r\n/g, '\n');
}

/**
 * 환경 변수 크로스 플랫폼 접근
 *
 * @example
 * getEnvVariable('HOME')  // Unix에서 /home/user, Windows에서 undefined (USERPROFILE 사용)
 */
export function getEnvVariable(name: string): string | undefined {
  // Windows에서 HOME이 없으면 USERPROFILE 사용
  if (getPlatform() === 'win32' && name === 'HOME') {
    return process.env.USERPROFILE || process.env.HOME;
  }

  return process.env[name];
}

/**
 * 파일명 유효성 검사 (크로스 플랫폼)
 *
 * Windows/Unix 예약어 확인
 *
 * @example
 * isValidFilename('file.txt')   // true
 * isValidFilename('CON')         // false (Windows 예약어)
 * isValidFilename('file:name')   // false (비허가 문자)
 */
export function isValidFilename(filename: string): boolean {
  // Windows 예약어
  const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..+)?$/i;

  if (getPlatform() === 'win32' && windowsReserved.test(filename)) {
    return false;
  }

  // 공통 금지 문자 (Windows, Unix)
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  if (invalidChars.test(filename)) {
    return false;
  }

  // 길이 검사 (Windows: 255자, Unix: 256자)
  if (filename.length > 255) {
    return false;
  }

  return true;
}

/**
 * 플랫폼별 경로 구분자
 *
 * @example
 * getPathSeparator()  // '\\' (Windows) 또는 '/' (Unix)
 */
export function getPathSeparator(): string {
  return path.sep;
}

/**
 * 플랫폼 정보 객체
 */
export interface PlatformInfo {
  platform: Platform;
  homeDir: string;
  tempDir: string;
  zenDataDir: string;
  zenLogsDir: string;
  zenCacheDir: string;
  pathSeparator: string;
  lineEnding: string;
}

/**
 * 현재 플랫폼의 모든 정보 수집
 *
 * @example
 * const info = getPlatformInfo();
 * console.log(info.platform);  // 'darwin'
 */
export function getPlatformInfo(): PlatformInfo {
  const platform = getPlatform();

  return {
    platform,
    homeDir: getHomeDir(),
    tempDir: getTempDir(),
    zenDataDir: getZenDataDir(),
    zenLogsDir: getZenLogsDir(),
    zenCacheDir: getZenCacheDir(),
    pathSeparator: getPathSeparator(),
    lineEnding: platform === 'win32' ? '\\r\\n' : '\\n',
  };
}
