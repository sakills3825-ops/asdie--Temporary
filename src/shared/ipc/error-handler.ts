/**
 * IPC 에러 처리 및 응답 검증
 * 
 * 목적:
 * - 모든 IPC 에러를 일관되게 처리
 * - 에러 정보 필터링 (민감 정보 제외)
 * - 메시지 크기 제한 (DoS 공격 방지)
 * - 직렬화 가능성 검증
 * 
 * 설계:
 * - Error 타입별 처리 (BaseError, TypeError, etc.)
 * - 컨텍스트 정보 보안 필터링
 * - 응답 크기 제한 (메시지 + 세부정보)
 * - 재시도 정보 포함 (클라이언트가 재시도 판단)
 */

import { BaseError } from '../errors';
import { ERROR_CODES } from '../constants';
import type { IpcResponse } from './types';
import { isSerializable } from '../types/constraints';

// ============================================================================
// 상수 정의
// ============================================================================

/**
 * IPC 메시지 최대 크기 (bytes)
 * 
 * 근거:
 * - Electron IPC: 메시지는 구조화된 클론(structured clone)으로 전달
 * - 프로세스 간 버퍼: 보통 32MB 버퍼
 * - 안전한 제한: 메시지 당 10MB 이상 권장 X
 * - 설정: 메시지 크기 < 5MB (여유있는 선택)
 * - 응답 크기 < 1MB (일반적인 IPC 응답)
 * 
 * @see https://www.electronjs.org/docs/api/ipc-main
 */
export const MAX_IPC_MESSAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_IPC_ERROR_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * 에러 메시지 최대 길이 (characters)
 * 
 * 근거:
 * - 일반적인 에러 메시지: < 200자
 * - 상세 메시지: < 1,000자
 * - DoS 방지: > 10,000자 → 의심
 * - 제한: 5,000자 (합리적)
 */
export const MAX_ERROR_MESSAGE_LENGTH = 5000;

/**
 * 에러 details 객체 최대 깊이
 * 
 * 근거:
 * - 일반적인 details: 깊이 2-3 ({ field, reason, code })
 * - 순환 참조 감지 필요
 * - 매우 깊은 중첩: 성능 저하 + 메모리 사용
 * - 제한: 깊이 10 이상 금지
 */
export const MAX_ERROR_DETAILS_DEPTH = 10;

// ============================================================================
// 에러 필터링 (보안)
// ============================================================================

/**
 * 에러 정보 필터링
 * 
 * Renderer로 전달할 에러 정보에서 민감한 내용 제거:
 * - 파일 시스템 경로
 * - 내부 변수명
 * - 데이터베이스 쿼리
 * - 서버 IP/호스트
 * 
 * @param message - 원본 에러 메시지
 * @returns 필터링된 메시지
 */
/**
 * 파일 경로 마스킹
 */
function maskFilePaths(text: string): string {
  let result = text;
  result = result.replace(/\/Users\/[^/\s]*/g, '/home/user');
  result = result.replace(/C:\\Users\\[^\\]*/g, 'C:\\Users\\*');
  return result;
}

/**
 * IP 주소 마스킹
 */
function maskIpAddresses(text: string): string {
  return text.replace(/\b(\d{1,3}\.)(\d{1,3}\.)(\d{1,3}\.)(\d{1,3})\b/g, '$1$2*.*');
}

/**
 * 민감한 쿼리 제거
 */
function maskDatabaseQueries(text: string): string {
  return text.replace(
    /(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN)\s+[^\n]*/gi,
    '[database query hidden]'
  );
}

/**
 * 호스트명 마스킹
 */
function maskHostnames(text: string): string {
  return text.replace(
    /(?:localhost|127\.0\.0\.1):\d+/g,
    'localhost:****'
  );
}

/**
 * 메시지 길이 제한
 */
function truncateMessage(text: string, maxLength: number): string {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '... [truncated]';
  }
  return text;
}

export function filterErrorMessage(message: string): string {
  if (typeof message !== 'string') {
    return 'Unknown error occurred';
  }

  let filtered = message;
  filtered = maskFilePaths(filtered);
  filtered = maskIpAddresses(filtered);
  filtered = maskDatabaseQueries(filtered);
  filtered = maskHostnames(filtered);
  filtered = truncateMessage(filtered, MAX_ERROR_MESSAGE_LENGTH);

  return filtered;
}

/**
 * 에러 details 객체 필터링 및 크기 제한
 * 
 * @param details - 원본 details 객체
 * @param maxDepth - 최대 깊이 (기본값: MAX_ERROR_DETAILS_DEPTH)
 * @returns 필터링된 details 또는 undefined
 */
/**
 * 민감한 키인지 확인
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey.includes('password') ||
    lowerKey.includes('token') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('apikey') ||
    lowerKey.includes('auth')
  );
}

/**
 * 기본 타입 또는 serializable 타입인지 확인
 */
function isPrimitiveOrSerializable(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * 객체를 필터링하여 반환
 */
function filterObject(
  value: Record<string, unknown>,
  depth: number,
  maxDepth: number
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  const keys = Object.keys(value).slice(0, 50); // 객체 키 개수 제한

  for (const key of keys) {
    if (isSensitiveKey(key)) {
      filtered[key] = '[sensitive]';
    } else {
      filtered[key] = filterDetailValue(value[key], depth + 1, maxDepth);
    }
  }

  return filtered;
}

/**
 * 배열을 필터링하여 반환
 */
function filterArray(
  value: unknown[],
  depth: number,
  maxDepth: number
): unknown[] {
  const limit = value.length > 100 ? 100 : value.length; // 배열 크기 제한
  return value.slice(0, limit).map((v) => filterDetailValue(v, depth + 1, maxDepth));
}

/**
 * 에러 details 값 필터링 (내부 재귀 함수)
 */
function filterDetailValue(
  value: unknown,
  depth: number,
  maxDepth: number
): unknown {
  // 깊이 초과
  if (depth >= maxDepth) {
    return '[details truncated]';
  }

  // 기본 타입
  if (isPrimitiveOrSerializable(value)) {
    return value;
  }

  // 배열
  if (Array.isArray(value)) {
    return filterArray(value, depth, maxDepth);
  }

  // 객체
  if (typeof value === 'object') {
    return filterObject(value as Record<string, unknown>, depth, maxDepth);
  }

  // 함수, Symbol 등
  return '[non-serializable]';
}

export function filterErrorDetails(
  details: unknown,
  maxDepth: number = MAX_ERROR_DETAILS_DEPTH
): unknown {
  return filterDetailValue(details, 0, maxDepth);
}

// ============================================================================
// 에러 타입별 처리
// ============================================================================

/**
 * BaseError를 IPC 응답으로 변환
 * 
 * @param error - BaseError 인스턴스
 * @returns IPC 에러 응답
 */
export function handleBaseError(error: BaseError): IpcResponse<never> {
  return {
    success: false,
    error: filterErrorMessage(error.message),
    code: error.code,
  };
}

/**
 * 표준 Error를 IPC 응답으로 변환
 * 
 * Error 객체에서 스택 트레이스는 제외하고,
 * 메시지와 이름만 포함
 * 
 * @param error - Error 인스턴스
 * @returns IPC 에러 응답
 */
export function handleStandardError(error: Error): IpcResponse<never> {
  return {
    success: false,
    error: filterErrorMessage(error.message || error.toString()),
    code: ERROR_CODES.UNKNOWN,
  };
}

/**
 * 미확인 에러를 IPC 응답으로 변환
 * 
 * @param error - 미확인 에러 값
 * @param context - 에러 컨텍스트 (어디서 발생했는가)
 * @returns IPC 에러 응답
 */
export function handleUnknownError(error: unknown, context?: string): IpcResponse<never> {
  let message = 'Unknown error occurred';

  if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'number') {
    message = `Error code: ${error}`;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // 객체: JSON.stringify 시도
    try {
      message = JSON.stringify(error);
    } catch {
      message = '[complex error object]';
    }
  }

  return {
    success: false,
    error: filterErrorMessage(`${context ? `[${context}] ` : ''}${message}`),
    code: ERROR_CODES.UNKNOWN,
  };
}

// ============================================================================
// 응답 검증 및 크기 제한
// ============================================================================

/**
 * 응답 크기 계산 (대략적)
 * 
 * @param response - IPC 응답
 * @returns 예상 크기 (bytes)
 */
export function estimateResponseSize(response: unknown): number {
  const json = JSON.stringify(response);
  // UTF-8 인코딩 시 1자 = 1-4 bytes (평균 2 bytes)
  return json.length * 2;
}

/**
 * 응답 검증 및 크기 제한
 * 
 * @param response - 원본 응답
 * @param maxSize - 최대 크기 (bytes)
 * @returns 검증된 응답
 * @throws Error - 응답이 너무 크거나 직렬화 불가
 */
export function validateResponseSize(
  response: unknown,
  maxSize: number = MAX_IPC_MESSAGE_SIZE
): unknown {
  try {
    const size = estimateResponseSize(response);

    if (size > maxSize) {
      throw new Error(
        `Response too large: ${size} bytes > ${maxSize} bytes limit`
      );
    }

    return response;
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Response validation failed: ${e.message}`);
    }
    throw new Error('Response validation failed: unknown error');
  }
}

/**
 * 응답이 직렬화 가능한지 검증
 * 
 * @param response - 검증할 응답
 * @returns 직렬화 가능하면 true
 */
export function isResponseSerializable(response: unknown): boolean {
  if (response === undefined || response === null) {
    return false; // undefined/null은 IPC 응답으로 부적절
  }

  return isSerializable(response);
}

// ============================================================================
// 통합 에러 핸들러
// ============================================================================

/**
 * 모든 에러를 IPC 응답으로 통일된 방식으로 처리
 * 
 * 사용 패턴:
 * ```typescript
 * try {
 *   const result = await complexOperation();
 *   return { success: true, data: result };
 * } catch (error) {
 *   return handleIpcError(error, 'complexOperation');
 * }
 * ```
 * 
 * @param error - 발생한 에러
 * @param context - 에러 컨텍스트 (선택사항)
 * @returns IPC 에러 응답 (항상 success: false)
 */
export function handleIpcError(error: unknown, context?: string): IpcResponse<never> {
  // BaseError 타입
  if (error instanceof BaseError) {
    return handleBaseError(error);
  }

  // 표준 Error 타입
  if (error instanceof Error) {
    return handleStandardError(error);
  }

  // 미확인 타입
  return handleUnknownError(error, context);
}

// ============================================================================
// 핸들러 등록 검증 레지스트리
// ============================================================================

/**
 * IPC 핸들러 등록 추적
 * 
 * 목적:
 * - 중복 등록 감지
 * - 등록되지 않은 채널 감지
 * - 디버깅: 어느 파일에서 어느 채널을 등록했는가
 * 
 * @internal 프레임워크 내부용
 */
export class IpcHandlerRegistry {
  private handlers: Map<string, { path: string; count: number }> = new Map();

  /**
   * 핸들러 등록 기록
   * 
   * @param channel - 채널명
   * @param sourcePath - 등록 위치 (파일 경로)
   * @throws Error - 중복 등록 시
   */
  registerHandler(channel: string, sourcePath: string): void {
    const existing = this.handlers.get(channel);

    if (existing) {
      existing.count += 1;

      if (existing.count > 1) {
        console.warn(
          `⚠️ IPC Handler '${channel}' registered multiple times:\n` +
            `  1. ${existing.path}\n` +
            `  2. ${sourcePath}\n` +
            `  (count: ${existing.count})`
        );
      }
    } else {
      this.handlers.set(channel, { path: sourcePath, count: 1 });
    }
  }

  /**
   * 등록된 핸들러 목록 조회
   */
  getRegistrations(): Record<string, { path: string; count: number }> {
    return Object.fromEntries(this.handlers);
  }

  /**
   * 등록되지 않은 채널 찾기
   * 
   * @param allChannels - 모든 유효한 채널명
   * @returns 등록되지 않은 채널 목록
   */
  getUnregisteredChannels(allChannels: string[]): string[] {
    return allChannels.filter((channel) => !this.handlers.has(channel));
  }

  /**
   * 레지스트리 초기화
   */
  clear(): void {
    this.handlers.clear();
  }
}

// 전역 레지스트리 (싱글톤)
export const ipcHandlerRegistry = new IpcHandlerRegistry();
