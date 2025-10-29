/**
 * PathResolver - 경로 해석 유틸
 *
 * 책임: 안전한 경로 처리
 * - 경로 정규화
 * - 경로 검증
 * - 상대/절대 경로 변환
 * - 경로 결합
 *
 * SRP 원칙: 경로 처리 로직만 담당
 */

import { join, normalize, resolve, dirname, basename, extname, isAbsolute } from 'path';
import { homedir } from 'os';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';

/**
 * 경로 해석 유틸
 */
export class PathResolver {
  private logger: ILogger;
  private readonly HOME_DIR = homedir();

  constructor() {
    this.logger = new LoggerImpl('PathResolver', LogLevel.INFO);
  }

  /**
   * 경로 정규화 (보안: 상위 디렉토리 접근 방지)
   */
  public normalizePath(filePath: string, baseDir?: string): string {
    try {
      if (!filePath) {
        throw new Error('경로를 입력해주세요');
      }

      // 홈 디렉토리 치환
      let normalizedPath = filePath.replace('~', this.HOME_DIR);

      // 기본 경로가 지정된 경우 상대 경로를 절대 경로로 변환
      if (baseDir && !isAbsolute(normalizedPath)) {
        normalizedPath = join(baseDir, normalizedPath);
      }

      // 경로 정규화
      normalizedPath = normalize(normalizedPath);

      // 상위 디렉토리 접근 시도 방지
      const basePath = baseDir ? normalize(baseDir) : this.HOME_DIR;
      const resolvedPath = resolve(normalizedPath);

      if (!resolvedPath.startsWith(basePath)) {
        throw new Error(`보안 경고: 허용되지 않은 경로 접근 시도 (${filePath})`);
      }

      return resolvedPath;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to normalize path', err);
      throw err;
    }
  }

  /**
   * 경로 결합 (안전하게)
   */
  public joinPath(...segments: string[]): string {
    try {
      if (segments.length === 0) {
        throw new Error('최소 하나의 경로 세그먼트가 필요합니다');
      }

      const joined = join(...segments);
      return normalize(joined);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to join paths', err);
      throw err;
    }
  }

  /**
   * 절대 경로로 변환
   */
  public toAbsolutePath(filePath: string, baseDir: string = process.cwd()): string {
    try {
      if (!filePath) {
        throw new Error('경로를 입력해주세요');
      }

      let absolutePath = filePath.replace('~', this.HOME_DIR);

      if (!isAbsolute(absolutePath)) {
        absolutePath = join(baseDir, absolutePath);
      }

      return normalize(absolutePath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to convert to absolute path', err);
      throw err;
    }
  }

  /**
   * 상대 경로로 변환
   */
  public toRelativePath(filePath: string, fromDir: string = process.cwd()): string {
    try {
      if (!filePath) {
        throw new Error('경로를 입력해주세요');
      }

      const absolutePath = this.toAbsolutePath(filePath);
      const resolvedFrom = resolve(fromDir);

      // Node.js path 모듈의 relative 함수 사용
      const relativePath = require('path').relative(resolvedFrom, absolutePath);

      return relativePath;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to convert to relative path', err);
      throw err;
    }
  }

  /**
   * 디렉토리 경로 추출
   */
  public getDir(filePath: string): string {
    try {
      if (!filePath) {
        throw new Error('경로를 입력해주세요');
      }

      return dirname(filePath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to get directory', err);
      throw err;
    }
  }

  /**
   * 파일명 추출 (확장자 포함)
   */
  public getFileName(filePath: string): string {
    try {
      if (!filePath) {
        throw new Error('경로를 입력해주세요');
      }

      return basename(filePath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to get filename', err);
      throw err;
    }
  }

  /**
   * 파일명 추출 (확장자 제외)
   */
  public getFileNameWithoutExt(filePath: string): string {
    try {
      if (!filePath) {
        throw new Error('경로를 입력해주세요');
      }

      const fileName = basename(filePath);
      return fileName.replace(extname(fileName), '');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to get filename without extension', err);
      throw err;
    }
  }

  /**
   * 확장자 추출
   */
  public getExtension(filePath: string): string {
    try {
      if (!filePath) {
        throw new Error('경로를 입력해주세요');
      }

      return extname(filePath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to get extension', err);
      throw err;
    }
  }

  /**
   * 절대 경로인지 확인
   */
  public isAbsolute(filePath: string): boolean {
    if (!filePath) return false;
    return isAbsolute(filePath);
  }

  /**
   * 경로가 유효한지 확인 (형식 검증만)
   */
  public isValidPath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    // 경로에 허용되지 않는 문자 확인 (Windows/Unix 모두 고려)
    const invalidChars = /[\0\x00]/; // null 문자 등
    if (invalidChars.test(filePath)) {
      return false;
    }

    return true;
  }

  /**
   * 홈 디렉토리 경로 사용자 친화적으로 표시
   */
  public toUserPath(filePath: string): string {
    try {
      if (!filePath) {
        return '';
      }

      const absolutePath = this.toAbsolutePath(filePath);

      if (absolutePath.startsWith(this.HOME_DIR)) {
        return absolutePath.replace(this.HOME_DIR, '~');
      }

      return absolutePath;
    } catch (error) {
      // 변환 실패 시 원본 반환
      return filePath;
    }
  }

  /**
   * 여러 경로 중 공통 부모 디렉토리 찾기
   */
  public findCommonDir(paths: string[]): string {
    try {
      if (paths.length === 0) {
        throw new Error('최소 하나의 경로가 필요합니다');
      }

      const firstPath = paths[0];
      if (!firstPath) {
        throw new Error('첫 번째 경로가 유효하지 않습니다');
      }

      if (paths.length === 1) {
        return dirname(firstPath);
      }

      // 모든 경로를 절대 경로로 변환
      const absolutePaths = paths.map((p) => normalize(resolve(p)));

      // 첫 번째 경로의 부모 디렉토리부터 시작
      const firstAbsolutePath = absolutePaths[0];
      if (!firstAbsolutePath) {
        throw new Error('경로 변환 실패');
      }

      let commonDir = dirname(firstAbsolutePath);

      // 모든 경로가 commonDir로 시작하는지 확인
      while (!absolutePaths.every((p) => p?.startsWith(commonDir))) {
        const parentDir = dirname(commonDir);
        if (parentDir === commonDir) {
          // 루트에 도달한 경우
          return commonDir;
        }
        commonDir = parentDir;
      }

      return commonDir;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('PathResolver: Failed to find common directory', err);
      throw err;
    }
  }
}
