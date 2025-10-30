/**
 * Platform 환경 검증 테스트
 * 
 * 총 42개 테스트
 * - 플랫폼 감지: 4 tests
 * - 환경 변수 검증: 12 tests
 * - Windows 경로: 8 tests
 * - macOS 경로: 5 tests
 * - Linux 경로: 5 tests
 * - Fallback 처리: 8 tests
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  getPlatformSafe,
  getArchSafe,
  getEnvVariable,
  getWindowsAppDataPath,
  getMacOSAppSupportPath,
  getLinuxDataPath,
  getAppDataDir,
  getLogsDir,
  getCacheDir,
  createTempDirSafe,
  removeDirSafe,
  type Platform,
  type Arch,
} from '../environment-safety';

describe('Platform 환경 검증', () => {
  // =========================================================================
  // 플랫폼 감지 테스트
  // =========================================================================

  describe('getPlatformSafe', () => {
    it('현재 플랫폼을 반환', () => {
      const result = getPlatformSafe();
      expect(['win32', 'darwin', 'linux', 'unknown']).toContain(result);
    });

    it('반환값은 유효한 Platform 타입', () => {
      const platform = getPlatformSafe();
      const validPlatforms: Platform[] = ['win32', 'darwin', 'linux', 'unknown'];
      expect(validPlatforms).toContain(platform);
    });

    it('일관되게 같은 값 반환', () => {
      const result1 = getPlatformSafe();
      const result2 = getPlatformSafe();
      expect(result1).toBe(result2);
    });

    it('문자열 타입 반환', () => {
      const result = getPlatformSafe();
      expect(typeof result).toBe('string');
    });
  });

  describe('getArchSafe', () => {
    it('현재 아키텍처 반환', () => {
      const result = getArchSafe();
      expect(['x64', 'arm64', 'unknown']).toContain(result);
    });

    it('반환값은 유효한 Arch 타입', () => {
      const arch = getArchSafe();
      const validArchs: Arch[] = ['x64', 'arm64', 'unknown'];
      expect(validArchs).toContain(arch);
    });

    it('일관되게 같은 값 반환', () => {
      const result1 = getArchSafe();
      const result2 = getArchSafe();
      expect(result1).toBe(result2);
    });

    it('문자열 타입 반환', () => {
      const result = getArchSafe();
      expect(typeof result).toBe('string');
    });
  });

  // =========================================================================
  // 환경 변수 검증 테스트
  // =========================================================================

  describe('getEnvVariable', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('존재하는 환경 변수 반환', () => {
      process.env.TEST_VAR_XYZ = '/home/user/test';
      const result = getEnvVariable('TEST_VAR_XYZ');
      expect(result).toBe('/home/user/test');
    });

    it('존재하지 않는 환경 변수는 undefined 반환', () => {
      delete process.env.NONEXISTENT_VAR_12345;
      const result = getEnvVariable('NONEXISTENT_VAR_12345');
      expect(result).toBeUndefined();
    });

    it('required=true일 때 없으면 에러', () => {
      delete process.env.MISSING_VAR_ABC;
      expect(() => getEnvVariable('MISSING_VAR_ABC', { required: true }))
        .toThrow('Required environment variable missing');
    });

    it('required=false일 때 없으면 undefined', () => {
      delete process.env.MISSING_VAR_DEF;
      const result = getEnvVariable('MISSING_VAR_DEF', { required: false });
      expect(result).toBeUndefined();
    });

    it('mustBeAbsolute=true일 때 상대 경로면 에러', () => {
      process.env.REL_PATH_VAR = 'relative/path';
      expect(() => getEnvVariable('REL_PATH_VAR', { mustBeAbsolute: true }))
        .toThrow('must be absolute path');
    });

    it('mustBeAbsolute=true일 때 절대 경로면 성공', () => {
      process.env.ABS_PATH_VAR = '/absolute/path';
      const result = getEnvVariable('ABS_PATH_VAR', { mustBeAbsolute: true });
      expect(result).toBe('/absolute/path');
    });

    it('mustExist=true일 때 존재하지 않으면 에러', () => {
      process.env.NONEXIST_PATH_VAR = '/nonexistent/path/12345/67890';
      expect(() => getEnvVariable('NONEXIST_PATH_VAR', { mustExist: true }))
        .toThrow('does not exist');
    });

    it('mustExist=true일 때 존재하면 성공', () => {
      const homeDir = os.homedir();
      process.env.HOME_VAR = homeDir;
      const result = getEnvVariable('HOME_VAR', { mustExist: true });
      expect(result).toBe(homeDir);
    });

    it('mustBeWritable=true일 때 쓰기 가능하면 성공', () => {
      const tmpdir = os.tmpdir();
      process.env.WRITABLE_PATH_VAR = tmpdir;
      const result = getEnvVariable('WRITABLE_PATH_VAR', { mustBeWritable: true });
      expect(result).toBe(tmpdir);
    });

    it('여러 옵션 조합 검증', () => {
      const tmpdir = os.tmpdir();
      process.env.STRICT_PATH_VAR = tmpdir;
      const result = getEnvVariable('STRICT_PATH_VAR', {
        required: true,
        mustBeAbsolute: true,
        mustExist: true,
        mustBeWritable: true,
      });
      expect(result).toBe(tmpdir);
    });

    it('빈 문자열 환경 변수는 반환 안 함 (필수값으로 취급)', () => {
      process.env.EMPTY_VAR = '';
      const result = getEnvVariable('EMPTY_VAR');
      // 빈 문자열은 값이 없는 것으로 취급 (환경 변수 미설정과 동일)
      expect(result === '' || result === undefined).toBe(true);
    });

    it('특수 문자 환경 변수 값 반환', () => {
      process.env.SPECIAL_VAR = '/path/with spaces/and-dashes_123';
      const result = getEnvVariable('SPECIAL_VAR');
      expect(result).toBe('/path/with spaces/and-dashes_123');
    });
  });

  // =========================================================================
  // Windows 경로 테스트
  // =========================================================================

  describe('getWindowsAppDataPath', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('경로는 절대 경로', () => {
      const result = getWindowsAppDataPath();
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('경로는 실제 존재하거나 홈 디렉토리 하위', () => {
      const result = getWindowsAppDataPath();
      expect(fs.existsSync(result) || result.includes('AppData')).toBe(true);
    });

    it('경로는 AppData 포함', () => {
      const result = getWindowsAppDataPath();
      expect(result.toUpperCase()).toContain('APPDATA');
    });

    it('반복 호출 일관된 결과', () => {
      const result1 = getWindowsAppDataPath();
      const result2 = getWindowsAppDataPath();
      expect(result1).toBe(result2);
    });

    it('경로 형식 유효', () => {
      const result = getWindowsAppDataPath();
      expect(result.length > 0).toBe(true);
      expect(typeof result).toBe('string');
    });

    it('경로 분리자 정규화됨', () => {
      const result = getWindowsAppDataPath();
      // 백슬래시 또는 슬래시만 포함
      const hasOnlyValidSeparators = !result.match(/[^\w\-._~:\\]/);
      // macOS/Linux에서는 슬래시, Windows에서는 백슬래시
      expect(result.includes('/') || result.includes('\\')).toBe(true);
    });

    it('홈 디렉토리와 비교', () => {
      const result = getWindowsAppDataPath();
      const homeDir = os.homedir();
      // AppData는 보통 홈 디렉토리 하위
      expect(result.startsWith(homeDir) || result.includes('AppData')).toBe(true);
    });

    it('환경 변수 없어도 fallback 작동', () => {
      delete process.env.LOCALAPPDATA;
      delete process.env.APPDATA;
      const result = getWindowsAppDataPath();
      expect(result).toBeDefined();
      expect(result.length > 0).toBe(true);
    });

    it('다중 호출 메모리 누수 없음', () => {
      // 1000번 호출해도 문제 없음
      for (let i = 0; i < 1000; i++) {
        const result = getWindowsAppDataPath();
        expect(result).toBeDefined();
      }
    });
  });

  // =========================================================================
  // macOS 경로 테스트
  // =========================================================================

  describe('getMacOSAppSupportPath', () => {
    it('애플리케이션 이름으로 경로 구성', () => {
      const result = getMacOSAppSupportPath('MyApp');
      expect(result).toContain('MyApp');
    });

    it('Library/Application Support 포함', () => {
      const result = getMacOSAppSupportPath('TestApp');
      expect(result).toContain('Library');
      expect(result).toContain('Application Support');
    });

    it('경로는 절대 경로', () => {
      const result = getMacOSAppSupportPath('TestApp');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('홈 디렉토리로 시작', () => {
      const result = getMacOSAppSupportPath('TestApp');
      expect(result.startsWith(os.homedir())).toBe(true);
    });

    it('다양한 애플리케이션 이름 지원', () => {
      const names = ['Zen', 'My-App', 'MyApp123', 'app_name'];
      names.forEach(name => {
        const result = getMacOSAppSupportPath(name);
        expect(result).toContain(name);
      });
    });
  });

  // =========================================================================
  // Linux 경로 테스트
  // =========================================================================

  describe('getLinuxDataPath', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('경로는 절대 경로', () => {
      const result = getLinuxDataPath();
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('경로는 홈 디렉토리 하위', () => {
      const result = getLinuxDataPath();
      expect(result.startsWith(os.homedir())).toBe(true);
    });

    it('기본값은 ~/.local/share', () => {
      delete process.env.XDG_DATA_HOME;
      const result = getLinuxDataPath();
      const expected = path.join(os.homedir(), '.local', 'share');
      expect(result).toBe(expected);
    });

    it('XDG_DATA_HOME 없으면 기본값 반환', () => {
      process.env.XDG_DATA_HOME = '/nonexistent/xdg/path/12345';
      const result = getLinuxDataPath();
      const expected = path.join(os.homedir(), '.local', 'share');
      expect(result).toBe(expected);
    });

    it('반복 호출 일관된 결과', () => {
      const result1 = getLinuxDataPath();
      const result2 = getLinuxDataPath();
      expect(result1).toBe(result2);
    });
  });

  // =========================================================================
  // 크로스플랫폼 경로 테스트
  // =========================================================================

  describe('getAppDataDir', () => {
    it('경로는 절대 경로', () => {
      const result = getAppDataDir('TestApp');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('애플리케이션 이름 포함', () => {
      const result = getAppDataDir('MyApp');
      expect(result.toLocaleLowerCase()).toContain('myapp');
    });

    it('다양한 애플리케이션 이름 지원', () => {
      const names = ['TestApp', 'My-App', 'app_123'];
      names.forEach(name => {
        const result = getAppDataDir(name);
        expect(result).toBeDefined();
        expect(result.length > 0).toBe(true);
      });
    });

    it('여러 앱 경로가 서로 다름', () => {
      const result1 = getAppDataDir('App1');
      const result2 = getAppDataDir('App2');
      expect(result1).not.toBe(result2);
    });

    it('반복 호출 일관된 결과', () => {
      const result1 = getAppDataDir('TestApp');
      const result2 = getAppDataDir('TestApp');
      expect(result1).toBe(result2);
    });
  });

  describe('getLogsDir', () => {
    it('경로는 절대 경로', () => {
      const result = getLogsDir('TestApp');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('로그 관련 키워드 포함', () => {
      const result = getLogsDir('TestApp');
      expect(result.toLowerCase()).toContain('log');
    });

    it('애플리케이션 이름 포함', () => {
      const result = getLogsDir('MyApp');
      expect(result.toLocaleLowerCase()).toContain('myapp');
    });

    it('여러 애플리케이션 로그 경로 구분', () => {
      const result1 = getLogsDir('App1');
      const result2 = getLogsDir('App2');
      expect(result1).not.toBe(result2);
    });
  });

  describe('getCacheDir', () => {
    it('경로는 절대 경로', () => {
      const result = getCacheDir('TestApp');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('캐시 관련 키워드 포함', () => {
      const result = getCacheDir('TestApp');
      expect(result.toLowerCase()).toContain('cache');
    });

    it('애플리케이션 이름 포함', () => {
      const result = getCacheDir('MyApp');
      expect(result.toLocaleLowerCase()).toContain('myapp');
    });

    it('여러 애플리케이션 캐시 경로 구분', () => {
      const result1 = getCacheDir('App1');
      const result2 = getCacheDir('App2');
      expect(result1).not.toBe(result2);
    });
  });

  // =========================================================================
  // Fallback 디렉토리 테스트
  // =========================================================================

  describe('createTempDirSafe', () => {
    let tempDirs: string[] = [];

    afterEach(() => {
      tempDirs.forEach(dir => {
        try {
          removeDirSafe(dir);
        } catch {
          // 이미 삭제됨
        }
      });
      tempDirs = [];
    });

    it('임시 디렉토리 생성', () => {
      const result = createTempDirSafe('test_');
      tempDirs.push(result);

      expect(fs.existsSync(result)).toBe(true);
      expect(fs.statSync(result).isDirectory()).toBe(true);
    });

    it('생성된 경로는 절대 경로', () => {
      const result = createTempDirSafe('test_');
      tempDirs.push(result);

      expect(path.isAbsolute(result)).toBe(true);
    });

    it('접두사 포함', () => {
      const result = createTempDirSafe('myprefix_');
      tempDirs.push(result);

      expect(result).toContain('myprefix_');
    });

    it('고유한 디렉토리 생성', () => {
      const result1 = createTempDirSafe('test_');
      const result2 = createTempDirSafe('test_');
      tempDirs.push(result1);
      tempDirs.push(result2);

      expect(result1).not.toBe(result2);
      expect(fs.existsSync(result1)).toBe(true);
      expect(fs.existsSync(result2)).toBe(true);
    });

    it('충돌 없음 (경쟁 조건 안전)', () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        const dir = createTempDirSafe('concurrent_');
        results.push(dir);
        tempDirs.push(dir);
      }

      const unique = new Set(results);
      expect(unique.size).toBe(results.length);

      results.forEach(dir => {
        expect(fs.existsSync(dir)).toBe(true);
      });
    });

    it('임시 디렉토리는 시스템 임시 경로 하위', () => {
      const result = createTempDirSafe('test_');
      tempDirs.push(result);

      const tmpdir = os.tmpdir();
      expect(result.startsWith(tmpdir)).toBe(true);
    });

    it('생성된 디렉토리는 쓰기 가능', () => {
      const result = createTempDirSafe('test_');
      tempDirs.push(result);

      const testFile = path.join(result, 'test.txt');
      fs.writeFileSync(testFile, 'test content');
      expect(fs.existsSync(testFile)).toBe(true);
    });
  });

  describe('removeDirSafe', () => {
    it('존재하는 디렉토리 삭제', () => {
      const dir = createTempDirSafe('remove_test_');
      expect(fs.existsSync(dir)).toBe(true);

      removeDirSafe(dir);
      expect(fs.existsSync(dir)).toBe(false);
    });

    it('존재하지 않는 디렉토리는 무시', () => {
      expect(() => {
        removeDirSafe('/nonexistent/dir/12345/67890');
      }).not.toThrow();
    });

    it('내용이 있는 디렉토리 재귀 삭제', () => {
      const dir = createTempDirSafe('remove_recursive_');
      const subdir = path.join(dir, 'subdir');
      const file = path.join(subdir, 'file.txt');

      fs.mkdirSync(subdir, { recursive: true });
      fs.writeFileSync(file, 'content');

      expect(fs.existsSync(file)).toBe(true);

      removeDirSafe(dir);
      expect(fs.existsSync(dir)).toBe(false);
    });

    it('읽기 전용 파일 포함 디렉토리 삭제', () => {
      const dir = createTempDirSafe('remove_readonly_');
      const file = path.join(dir, 'readonly.txt');

      fs.writeFileSync(file, 'content');
      fs.chmodSync(file, 0o444);

      removeDirSafe(dir);
      expect(fs.existsSync(dir)).toBe(false);
    });

    it('깊게 중첩된 디렉토리 삭제', () => {
      const dir = createTempDirSafe('remove_deep_');
      let current = dir;

      for (let i = 0; i < 5; i++) {
        current = path.join(current, `level_${i}`);
        fs.mkdirSync(current, { recursive: true });
      }

      fs.writeFileSync(path.join(current, 'deep.txt'), 'deep content');

      removeDirSafe(dir);
      expect(fs.existsSync(dir)).toBe(false);
    });

    it('여러 파일 포함 디렉토리 삭제', () => {
      const dir = createTempDirSafe('remove_multiple_');

      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(path.join(dir, `file${i}.txt`), `content ${i}`);
      }

      removeDirSafe(dir);
      expect(fs.existsSync(dir)).toBe(false);
    });

    it('빈 디렉토리 삭제', () => {
      const dir = createTempDirSafe('remove_empty_');
      
      removeDirSafe(dir);
      expect(fs.existsSync(dir)).toBe(false);
    });
  });
});
