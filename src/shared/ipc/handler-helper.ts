/**
 * IPC 핸들러 헬퍼 (검증 통합)
 *
 * IPC 핸들러 구현 시 자동으로 검증 + 에러 처리를 수행하는 헬퍼.
 *
 * 사용 예시:
 * ```typescript
 * const navigateHandler = createIpcHandler(async (args) => {
 *   const url = validateUrl(args.url); // ValidationError 발생 시 자동 에러 응답
 *   // ... 처리 로직
 *   return IpcResponseHelper.success(undefined);
 * });
 * ```
 */

import { IpcResponse, IpcResponseHelper } from './types';
import { BaseError } from '../errors';

/**
 * IPC 핸들러에서 에러를 IPC 응답으로 변환
 *
 * 정책:
 * - ValidationError, BaseError: 에러 코드 + 메시지 반환
 * - 기타 Error: "Internal Server Error" 반환 (보안)
 * - 예상치 못한 오류: 로깅 + 에러 응답
 *
 * @param error - 발생한 에러
 * @param context - 디버깅 정보 (로깅용)
 * @returns IPC 에러 응답
 */
export function handleIpcError(error: unknown, context?: Record<string, unknown>): IpcResponse {
  // ValidationError 또는 BaseError 처리
  if (error instanceof BaseError) {
    return IpcResponseHelper.error(error.message, error.code);
  }

  // 일반 Error 처리
  if (error instanceof Error) {
    // 개발 환경에서는 상세 메시지 표시
    const isDev = process.env.NODE_ENV === 'development';
    const message = isDev ? error.message : 'An error occurred';

    // 기본 에러 코드
    const code = 'E_UNKNOWN';

    // 로깅 (나중에 logger 연동)
    if (isDev && context) {
      console.error('[IPC Error]', error.message, context);
    }

    return IpcResponseHelper.error(message, code);
  }

  // 예상치 못한 형태의 에러
  return IpcResponseHelper.error('Unknown error occurred', 'E_UNKNOWN');
}

/**
 * IPC 핸들러 래퍼 (에러 처리 자동화)
 *
 * 핸들러에서 발생하는 에러를 자동으로 IPC 응답으로 변환.
 *
 * 사용 예시:
 * ```typescript
 * const handler = wrapIpcHandler(async (args) => {
 *   const url = validateUrl(args.url); // ValidationError → 자동 처리
 *   const result = await processUrl(url);
 *   return IpcResponseHelper.success(result);
 * });
 * ```
 *
 * @param handler - IPC 핸들러 함수
 * @param context - 디버깅/로깅 컨텍스트
 * @returns 래핑된 핸들러 (에러 처리 포함)
 */
export function wrapIpcHandler<T = void, Args = void>(
  handler: (args: Args) => Promise<IpcResponse<T>>,
  context?: Record<string, unknown>
): (args: Args) => Promise<IpcResponse<T>> {
  return async (args: Args): Promise<IpcResponse<T>> => {
    try {
      return await handler(args);
    } catch (error) {
      return handleIpcError(error, context) as IpcResponse<T>;
    }
  };
}
