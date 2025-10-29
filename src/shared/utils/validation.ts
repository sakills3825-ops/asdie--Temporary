/**
 * 공유 검증 유틸리티
 *
 * Main/Renderer 모두에서 사용할 수 있는 검증 로직.
 * URL, 파일 경로, 기본 포맷 등.
 */

import { ValidationError } from '../errors';

/**
 * Aside 브라우저에서 허용하는 URL 프로토콜 화이트리스트
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'blob:', 'data:']);

/**
 * URL 유효성 검사 (기본)
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * URL 검증 - Aside 브라우저 호환성 포함
 *
 * - 기본 URL 형식 검증
 * - 프로토콜 화이트리스트 확인
 * - SSRF 방지 (local IP 차단 안 함, 필요시 추가)
 */
export function validateUrl(url: string): string {
  if (!isValidUrl(url)) {
    throw new ValidationError(`Invalid URL format: ${url}`, { url });
  }

  try {
    const parsed = new URL(url);

    // 프로토콜 검증
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new ValidationError(
        `URL protocol not allowed: ${parsed.protocol}. Allowed: ${Array.from(ALLOWED_PROTOCOLS).join(', ')}`,
        { url, protocol: parsed.protocol }
      );
    }

    return url;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Invalid URL: ${url}`, { url });
  }
}

/**
 * 이메일 유효성 검사 (기본 정규식)
 *
 * 주의: RFC 5322 완전 호환이 아님
 * 실제 이메일 검증은 발신 필요
 */
export function isValidEmail(email: string): boolean {
  // 기본적인 이메일 형식 (너무 느슨하지도, 너무 엄격하지도 않게)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * 파일 경로 유효성 검사 (보안 강화)
 *
 * 차단 패턴:
 * - .. (상위 디렉토리 접근)
 * - ~ (홈 디렉토리 매크로)
 * - 절대 경로 (/, C:\ 등)
 * - 심볼릭 링크 수정(traversal)
 *
 * Windows/macOS/Linux 경로 지원
 */
export function isValidFilePath(filePath: string): boolean {
  // 공백만 있는 경로
  if (!filePath || filePath.trim().length === 0) {
    return false;
  }

  // 위험한 패턴 체크
  const dangerousPatterns = [
    /\.\./, // 상위 디렉토리
    /^[~]/, // 홈 디렉토리 매크로
    /^[/\\]/, // 절대 경로 (Unix/Windows)
    /^[a-zA-Z]:[/\\]/, // Windows 드라이브 경로
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1f]/, // 제어 문자
  ];

  if (dangerousPatterns.some((pattern) => pattern.test(filePath))) {
    return false;
  }

  return true;
}

/**
 * 파일 경로 검증 (실패 시 에러 throw)
 */
export function validateFilePath(filePath: string): string {
  if (!isValidFilePath(filePath)) {
    throw new ValidationError(`Invalid file path: ${filePath}`, { filePath });
  }
  return filePath;
}

/**
 * 필수 필드 검증
 */
export function validateRequired<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new ValidationError(`${fieldName} is required`, { fieldName });
  }
  return value;
}

/**
 * 숫자 범위 검증
 */
export function validateRange(value: number, min: number, max: number, fieldName: string): number {
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`, {
      fieldName,
      value,
      min,
      max,
    });
  }
  return value;
}

/**
 * 문자열 길이 검증
 */
export function validateStringLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string
): string {
  if (value.length < minLength || value.length > maxLength) {
    throw new ValidationError(`${fieldName} length must be between ${minLength} and ${maxLength}`, {
      fieldName,
      length: value.length,
      minLength,
      maxLength,
    });
  }
  return value;
}
