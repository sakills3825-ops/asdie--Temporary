/**
 * StaticFileServer - 정적 파일 제공 유틸
 *
 * 책임: 안전한 정적 파일 제공
 * - MIME 타입 결정
 * - 캐시 헤더
 * - 범위 요청 처리
 * - 보안 (디렉토리 탐색 방지)
 *
 * SRP 원칙: 정적 파일 제공 로직만 담당
 */

import { extname } from 'path';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';

/**
 * MIME 타입 매핑
 */
const MIME_TYPES: { [key: string]: string } = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
};

/**
 * 캐시 설정
 */
interface CacheControl {
  maxAge?: number; // 초 단위
  public?: boolean;
  private?: boolean;
  mustRevalidate?: boolean;
}

/**
 * 정적 파일 서버
 */
export class StaticFileServer {
  private logger: ILogger;
  private readonly DEFAULT_CACHE_CONTROL: CacheControl = {
    maxAge: 3600, // 1시간
    public: true,
  };

  constructor() {
    this.logger = new LoggerImpl('StaticFileServer', LogLevel.INFO);
  }

  /**
   * 파일 확장자에서 MIME 타입 결정
   */
  public getMimeType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    return MIME_TYPES[ext] ?? 'application/octet-stream';
  }

  /**
   * 캐시 제어 헤더 생성
   */
  public generateCacheControlHeader(cacheControl?: CacheControl): string {
    const config = { ...this.DEFAULT_CACHE_CONTROL, ...cacheControl };
    const parts: string[] = [];

    if (config.public) parts.push('public');
    if (config.private) parts.push('private');
    if (config.maxAge !== undefined) parts.push(`max-age=${config.maxAge}`);
    if (config.mustRevalidate) parts.push('must-revalidate');

    return parts.join(', ');
  }

  /**
   * ETag 생성 (간단한 해시)
   */
  public generateETag(content: Buffer | string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');

    if (typeof content === 'string') {
      hash.update(content);
    } else {
      hash.update(content);
    }

    return `"${hash.digest('hex')}"`;
  }

  /**
   * 캐시 가능한 파일인지 확인
   */
  public isCacheable(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();

    // 캐시하면 안 되는 확장자
    const nonCacheableExts = ['.html', '.xml'];

    if (nonCacheableExts.includes(ext)) {
      return false;
    }

    // HTML 파일 제외
    if (filePath.endsWith('.html')) {
      return false;
    }

    return true;
  }

  /**
   * 콘텐츠 압축 가능 여부 확인
   */
  public isCompressible(filePath: string): boolean {
    const mimeType = this.getMimeType(filePath);

    // 이미 압축된 형식은 제외
    const nonCompressibleMimes = [
      'image/',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/octet-stream',
    ];

    return !nonCompressibleMimes.some((mime) => mimeType.startsWith(mime));
  }

  /**
   * 범위 요청 파싱 (Range: bytes=0-100)
   */
  public parseRangeHeader(rangeHeader: string, fileSize: number): Array<{ start: number; end: number }> | null {
    try {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (!match) {
        return null;
      }

      const [, startStr = '', endStr = ''] = match;
      let start = parseInt(startStr, 10);
      let end = parseInt(endStr, 10);

      // 유효성 검증
      if (isNaN(start) && isNaN(end)) {
        return null;
      }

      if (isNaN(start)) {
        start = fileSize - end;
        end = fileSize - 1;
      } else if (isNaN(end)) {
        end = fileSize - 1;
      }

      // 범위 확인
      if (start < 0 || end >= fileSize || start > end) {
        return null;
      }

      return [{ start, end }];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('StaticFileServer: Failed to parse range header', err);
      return null;
    }
  }

  /**
   * 안전한 파일 경로 검증
   */
  public isPathSafe(filePath: string, baseDir: string): boolean {
    try {
      const path = require('path');
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(baseDir);

      // baseDir 하위인지 확인 (디렉토리 탐색 방지)
      if (!resolvedPath.startsWith(resolvedBase)) {
        this.logger.warn('StaticFileServer: Unsafe path attempt detected', {
          module: 'StaticFileServer',
          metadata: { filePath, baseDir },
        });
        return false;
      }

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('StaticFileServer: Failed to validate path', err);
      return false;
    }
  }

  /**
   * Content-Disposition 헤더 생성 (다운로드)
   */
  public generateContentDisposition(fileName: string, isInline: boolean = false): string {
    const disposition = isInline ? 'inline' : 'attachment';
    // RFC 5987 인코딩
    const encoded = encodeURIComponent(fileName);
    return `${disposition}; filename*=UTF-8''${encoded}`;
  }

  /**
   * 보안 헤더 생성
   */
  public generateSecurityHeaders(): { [key: string]: string } {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  }

  /**
   * 파일 크기 포맷팅 (인간 친화적)
   */
  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 디렉토리 목록 HTML 생성 (개발용)
   */
  public generateDirectoryListing(dirPath: string, files: Array<{ name: string; isDir: boolean; size: number }>): string {
    const escapeHtml = (text: string): string => {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return text.replace(/[&<>"']/g, (m: string) => map[m] ?? m);
    };

    const fileListHtml = files
      .map(
        (file) =>
          `<tr>
        <td><a href="${escapeHtml(file.name)}">${file.isDir ? '[DIR] ' : ''}${escapeHtml(file.name)}</a></td>
        <td>${file.isDir ? '-' : this.formatFileSize(file.size)}</td>
      </tr>`
      )
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Directory: ${escapeHtml(dirPath)}</title>
  <style>
    body { font-family: monospace; }
    table { border-collapse: collapse; }
    td { padding: 8px; border-bottom: 1px solid #ccc; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Directory: ${escapeHtml(dirPath)}</h1>
  <table>
    <tr>
      <th>Name</th>
      <th>Size</th>
    </tr>
    ${fileListHtml}
  </table>
</body>
</html>`;
  }
}
