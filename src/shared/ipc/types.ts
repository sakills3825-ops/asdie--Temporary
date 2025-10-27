/**
 * IPC 통신 관련 타입 정의
 *
 * Main-Renderer 간 메시지 구조, 응답 타입 등 정의
 */

/**
 * IPC 응답 - 성공 케이스
 *
 * @example
 * const response: IpcResponseSuccess<string> = {
 *   success: true,
 *   data: "result"
 * }
 */
export interface IpcResponseSuccess<T = void> {
  success: true;
  data: T;
  code?: string;
}

/**
 * IPC 응답 - 실패 케이스
 *
 * @example
 * const response: IpcResponseError = {
 *   success: false,
 *   error: "File not found",
 *   code: "E_FILE_NOT_FOUND"
 * }
 */
export interface IpcResponseError {
  success: false;
  error: string;
  code: string;
}

/**
 * IPC 응답 유니온 타입 (구분 가능한 유니온)
 *
 * success 필드에 따라 자동으로 타입 좁혀짐
 *
 * @example
 * const response: IpcResponse<string>;
 *
 * if (response.success) {
 *   // TypeScript가 자동으로 data의 존재를 알고있음
 *   console.log(response.data);
 * } else {
 *   // error와 code가 반드시 있음
 *   console.error(response.error, response.code);
 * }
 */
export type IpcResponse<T = void> = IpcResponseSuccess<T> | IpcResponseError;

/**
 * IPC 메시지 컨텍스트
 * 모든 IPC 요청/응답에 첨부할 메타데이터
 */
export interface IpcMessageContext {
  requestId: string; // 요청 추적용 ID
  timestamp: number; // 메시지 생성 시간
  sender: 'main' | 'renderer';
  correlationId?: string; // 연관된 요청 ID
}

/**
 * IPC 호출 핸들러 타입
 *
 * @example
 * const handler: IpcInvokeHandler<string, { path: string }> = async (args) => {
 *   const result = await readFile(args.path);
 *   return IpcResponseHelper.success(result);
 * }
 */
export type IpcInvokeHandler<T = void, Args = void> = (args: Args) => Promise<IpcResponse<T>>;

/**
 * IPC 이벤트 리스너 핸들러 타입
 */
export type IpcEventHandler<T = void> = (args: T) => void;

/**
 * IPC 응답 헬퍼 (타입 안전한 응답 생성)
 */
export const IpcResponseHelper = {
  /**
   * 성공 응답 생성
   *
   * @example
   * return IpcResponseHelper.success(data);
   * return IpcResponseHelper.success(data, 'E_SUCCESS');
   */
  success<T = void>(data: T, code?: string): IpcResponseSuccess<T> {
    if (code) {
      return { success: true, data, code };
    }
    return { success: true, data };
  },

  /**
   * 에러 응답 생성
   *
   * @example
   * return IpcResponseHelper.error('File not found', 'E_FILE_NOT_FOUND');
   */
  error(errorMessage: string, code: string = 'E_UNKNOWN'): IpcResponseError {
    return { success: false, error: errorMessage, code };
  },
};
